// flightController
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { pool, dbPrefix } = require('../config/db');

require('dotenv').config();

const duffel_access_tokens = process.env.DUFFEL_ACCESS_TOKENS;
const duffel_api_url = process.env.DUFFEL_API_URL;
const booking_base_url = process.env.BOOKING_BASE_URL;

const placesSuggestions = async (req, res) => {
  try {
    const baseUrl = `${duffel_api_url}/places/suggestions`;

    // Get all query params from request
    const { query, lat, lng, rad, types } = req.query;

    // Prepare query parameters dynamically
    const params = {
      ...(query && { query }),
      ...(lat && { lat }),
      ...(lng && { lng }),
      ...(rad && { rad }),
      ...(types && { types: Array.isArray(types) ? types : [types] }) // Support both single or multiple types
    };

    const response = await axios.get(baseUrl, {
      headers: {
        'Accept-Encoding': 'gzip',
        'Accept': 'application/json',
        'Duffel-Version': 'v2',
        'Authorization': `Bearer ${duffel_access_tokens}`
      },
      params
    });

    res.json(response.data);
  } catch (error) {
    console.error('Duffel Places API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Duffel API failed' });
  }
};


const offerRequests = async (req, res) => {
    try {
      const requestData = req.body;

      const response = await axios.post(
        `${duffel_api_url}/air/offer_requests`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${duffel_access_tokens}`,
            'Accept-Encoding': 'gzip',
            'Accept': 'application/json',
            'Duffel-Version': 'v2',
            'Content-Type': 'application/json'
          }
        }
      );

      // Success response forwarding
      // res.status(response.status).json(response.data);

      // Filter only essential data 
      const filteredResponse = filterDuffelResponse(response.data);
      res.status(response.status).json(filteredResponse);

    } catch (error) {
      // Duffel API error forwarding as-is
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        // Network or unknown error
        res.status(500).json({
          error: true,
          message: error.message
        });
      }
    }
};

const offerRequestsMultidate = async (req, res) => {
  try {
    const userData = req.body;
    const slices = userData.data.slices;
    const passengers = userData.data.passengers;
    const cabin_class = userData.data.cabin_class;

    const getDateOffset = (dateStr, offset) => {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + offset);
      return date.toISOString().split('T')[0];
    };

    let combinedOffers = [];
    let firstPassengersData = [];

    if (slices.length === 1) {
      // ONE-WAY: Search with date variations
      let searchCombinations = [];
      [-1, 0, 1].forEach(offset => {
        const depDate = getDateOffset(slices[0].departure_date, offset);
        const today = new Date().toISOString().split('T')[0];
        if (offset === -1 && depDate < today) return; // Skip -1 if past
        searchCombinations.push([
          {
            origin: slices[0].origin,
            destination: slices[0].destination,
            departure_date: depDate
          }
        ]);
      });

      // Execute one-way searches
      for (const combo of searchCombinations) {
        const requestBody = {
          data: {
            slices: combo,
            passengers: passengers,
            cabin_class: cabin_class
          }
        };

        const response = await axios.post(`${duffel_api_url}/air/offer_requests`, requestBody, {
          headers: {
            'Authorization': `Bearer ${duffel_access_tokens}`,
            'Accept-Encoding': 'gzip',
            'Accept': 'application/json',
            'Duffel-Version': 'v2',
            'Content-Type': 'application/json'
          }
        });

        const filteredResponse = filterDuffelResponse(response.data);

        if (firstPassengersData.length === 0) {
          firstPassengersData = filteredResponse?.data?.passengers || [];
        }

        const offers = filteredResponse?.data?.offers || [];
        combinedOffers = combinedOffers.concat(offers);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Optional delay
      }

    } else if (slices.length === 2) {
      // ROUND-TRIP: Handle as 2 separate one-way searches
      console.log('🔄 Processing round-trip as 2 separate one-way flights');
      
      let departureOffers = [];
      let returnOffers = [];

      // Search departure flights with date variations
      for (let offset of [-1, 0, 1]) {
        const depDate = getDateOffset(slices[0].departure_date, offset);
        const today = new Date().toISOString().split('T')[0];
        if (offset === -1 && depDate < today) continue; // Skip past dates

        const departureRequest = {
          data: {
            slices: [{
              origin: slices[0].origin,
              destination: slices[0].destination,
              departure_date: depDate
            }],
            passengers: passengers,
            cabin_class: cabin_class
          }
        };

        try {
          const depResponse = await axios.post(`${duffel_api_url}/air/offer_requests`, departureRequest, {
            headers: {
              'Authorization': `Bearer ${duffel_access_tokens}`,
              'Accept-Encoding': 'gzip',
              'Accept': 'application/json',
              'Duffel-Version': 'v2',
              'Content-Type': 'application/json'
            }
          });

          const filteredDepResponse = filterDuffelResponse(depResponse.data);
          if (firstPassengersData.length === 0) {
            firstPassengersData = filteredDepResponse?.data?.passengers || [];
          }

          const depOffers = filteredDepResponse?.data?.offers || [];
          departureOffers = departureOffers.concat(depOffers.map(offer => ({
            ...offer,
            flight_type: 'departure',
            search_date: depDate,
            original_date: slices[0].departure_date
          })));

          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error searching departure flights for ${depDate}:`, error.message);
        }
      }

      // Search return flights with date variations  
      for (let offset of [-1, 0, 1]) {
        const retDate = getDateOffset(slices[1].departure_date, offset);
        const today = new Date().toISOString().split('T')[0];
        if (offset === -1 && retDate < today) continue; // Skip past dates

        const returnRequest = {
          data: {
            slices: [{
              origin: slices[1].origin,
              destination: slices[1].destination,
              departure_date: retDate
            }],
            passengers: passengers,
            cabin_class: cabin_class
          }
        };

        try {
          const retResponse = await axios.post(`${duffel_api_url}/air/offer_requests`, returnRequest, {
            headers: {
              'Authorization': `Bearer ${duffel_access_tokens}`,
              'Accept-Encoding': 'gzip',
              'Accept': 'application/json',
              'Duffel-Version': 'v2',
              'Content-Type': 'application/json'
            }
          });

          const filteredRetResponse = filterDuffelResponse(retResponse.data);
          const retOffers = filteredRetResponse?.data?.offers || [];
          returnOffers = returnOffers.concat(retOffers.map(offer => ({
            ...offer,
            flight_type: 'return',
            search_date: retDate,
            original_date: slices[1].departure_date
          })));

          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error searching return flights for ${retDate}:`, error.message);
        }
      }

      // Combine departure and return offers into round-trip pairs
      console.log(`Found ${departureOffers.length} departure offers and ${returnOffers.length} return offers`);
      
      combinedOffers = createRoundTripPairs(departureOffers, returnOffers);
      console.log(`Created ${combinedOffers.length} round-trip combinations`);
    }
    // Return response for both one-way and round-trip

    res.status(200).json({
      success: true,
      data: {
        offers: combinedOffers,
        passengers: firstPassengersData
      }
    });

    //res.status(200).json(finalResults);

  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: true, message: error.message });
    }
  }
};

// Function to combine departure and return offers into round-trip pairs
function createRoundTripPairs(departureOffers, returnOffers) {
  const roundTripPairs = [];
  
  // Limit to reasonable number of combinations (max 5 pairs)
  const maxDepartures = Math.min(departureOffers.length, 5);
  const maxReturns = Math.min(returnOffers.length, 5);
  
  for (let i = 0; i < maxDepartures; i++) {
    for (let j = 0; j < maxReturns; j++) {
      const departureOffer = departureOffers[i];
      const returnOffer = returnOffers[j];
      
      // Calculate combined price
      const departurePrice = parseFloat(departureOffer.total_amount) || 0;
      const returnPrice = parseFloat(returnOffer.total_amount) || 0;
      const combinedPrice = departurePrice + returnPrice;
      
      // Create combined round-trip offer
      const roundTripOffer = {
        id: `rt_${departureOffer.id}_${returnOffer.id}`, // Combined ID
        departure_offer_id: departureOffer.id,
        return_offer_id: returnOffer.id,
        
        // Combined pricing
        total_amount: combinedPrice.toFixed(2),
        total_currency: departureOffer.total_currency || returnOffer.total_currency,
        base_amount: (parseFloat(departureOffer.base_amount || 0) + parseFloat(returnOffer.base_amount || 0)).toFixed(2),
        tax_amount: (parseFloat(departureOffer.tax_amount || 0) + parseFloat(returnOffer.tax_amount || 0)).toFixed(2),
        
        // Flight segments (both departure and return)
        slices: [
          ...(departureOffer.slices || []).map(slice => ({
            ...slice,
            flight_type: 'departure',
            original_offer_id: departureOffer.id
          })),
          ...(returnOffer.slices || []).map(slice => ({
            ...slice,
            flight_type: 'return',
            original_offer_id: returnOffer.id
          }))
        ],
        
        // Passenger information (from departure offer)
        passengers: departureOffer.passengers,
        
        // Metadata
        trip_type: 'round_trip',
        created_at: new Date().toISOString(),
        
        // Original offers for reference
        _departure_offer: departureOffer,
        _return_offer: returnOffer
      };
      
      roundTripPairs.push(roundTripOffer);
      
      // Limit total combinations to prevent too many options
      if (roundTripPairs.length >= 15) {
        break;
      }
    }
    
    if (roundTripPairs.length >= 15) {
      break;
    }
  }
  
  // Sort by price (cheapest first)
  return roundTripPairs.sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
}

// Filter function for Duffel flight offers
function filterDuffelResponse(data) {
    // Take only the first 10 offers
    const first10Offers = data.data.offers.slice(0, 5);

    const essentialFields = {
        //offers: data.data.offers.map(offer => ({
        offers:first10Offers.map(offer => ({
            id: offer.id,
            total_amount: offer.total_amount,
            total_currency: offer.total_currency,
            tax_amount: offer.tax_amount, // Added tax amount
            base_amount: offer.base_amount,
            slices: offer.slices.map(slice => ({
                origin: slice.origin.name,
                destination: slice.destination.name,
                departure: slice.segments[0].departing_at,
                arrival: slice.segments[0].arriving_at,
                flight_number: slice.segments[0].marketing_carrier_flight_number,
                airline: slice.segments[0].marketing_carrier.name,
                cabin_class: slice.segments[0].passengers[0].cabin_class_marketing_name, // Added cabin class
                baggage: {
                    checked: {
                        quantity: slice.segments[0].passengers[0].baggages.find(b => b.type === 'checked')?.quantity || 0,
                        weight_limit: '23kg' // Standard weight, customize as needed
                    },
                    carry_on: {
                        quantity: slice.segments[0].passengers[0].baggages.find(b => b.type === 'carry_on')?.quantity || 0,
                        weight_limit: '7kg' // Standard weight
                    }
                }
            })),
            passengers: offer.passengers.map(passenger => ({
                type: passenger.type,
                age: passenger.age
            })),
            conditions: {
                change_before_departure: offer.conditions.change_before_departure,
                refund_before_departure: {
                    allowed: offer.conditions.refund_before_departure?.allowed || false,
                    penalty_amount: offer.conditions.refund_before_departure?.penalty_amount || '0',
                    penalty_currency: offer.conditions.refund_before_departure?.penalty_currency || offer.total_currency
                },
                refund_type: offer.conditions.refund_before_departure?.allowed ? 
                    (offer.conditions.refund_before_departure.penalty_amount === '0' ? 
                        'Fully refundable' : 'Partially refundable') : 'Non-refundable' // Added refund type
            }
        })),
        passengers: data.data.passengers.map(p => ({
            type: p.type,
            age: p.age
        }))
    };

    return {
        success: true,
        data: essentialFields,
        expires_at: data.data.expires_at
    };
}

// const offers = async (req, res) => {
//   const offerId = req.query.offer_id;
//   const baseUrl = `${duffel_api_url}/air/offers/${offerId}`;

//   try {
//     const response = await axios.get(baseUrl, {
//       headers: {
//         'Accept-Encoding': 'gzip',
//         'Accept': 'application/json',
//         'Duffel-Version': 'v2',
//         'Authorization': `Bearer ${duffel_access_tokens}`
//       }
//     });

    
//     res.status(200).json(response.data);

//   } catch (error) {
    
//     console.error('Duffel API Error:', error.response?.data || error.message);
//     res.status(error.response?.status || 500).json({
//       error: 'Duffel API failed',
//       url:baseUrl,
//       detail: error.response?.data || error.message
//     });
//   }
// };
const offers = async (req, res) => {
  const offerId = req.query.offer_id;
  const baseUrl = `${duffel_api_url}/air/offers/${offerId}`;

  try {
    const response = await axios.get(baseUrl, {
      headers: {
        'Accept-Encoding': 'gzip',
        'Accept': 'application/json',
        'Duffel-Version': 'v2',
        'Authorization': `Bearer ${duffel_access_tokens}`
      }
    });

    const data = response.data.data;
    // Filtered slices data
    const slices = (data.slices || []).map(slice => ({
      origin: {
        airport_code: slice.origin?.iata_code || null,
        city_name: slice.origin?.city_name || null,
        country_name: slice.origin?.country_name || null,
        name: slice.origin?.name || null
        
      },
      destination: {
        airport_code: slice.destination?.iata_code || null,
        city_name: slice.destination?.city_name || null,
        country_name: slice.destination?.country_name || null,
        name: slice.destination?.name || null
      },
      duration: slice.duration || null,
      segments: (slice.segments || []).map(seg => ({
        marketing_carrier: {
          code: seg.marketing_carrier?.iata_code || null,
          name: seg.marketing_carrier?.name || null
        },
        operating_carrier: {
          code: seg.operating_carrier?.iata_code || null,
          name: seg.operating_carrier?.name || null
        },
        departure: {
          airport_code: seg.departure_airport?.iata_code || null,
          at: seg.departing_at || null
        },
        arrival: {
          airport_code: seg.arrival_airport?.iata_code || null,
          at: seg.arriving_at || null
        },
        duration: seg.duration || null
      }))
    }));

     //res.status(200).json(slices);
    const shortJson = {
      data: {
        id: data.id,
        slices: slices,
        owner: data.owner,
        conditions:data.conditions,
        passengers: (data.passengers || []).map(p => ({
          loyalty_programme_accounts: p.loyalty_programme_accounts || [],
          family_name: p.family_name || null,
          given_name: p.given_name || null,
          age: p.age || null,
          type: p.type || null,
          passengers_id: p.id || null
        })),
        total_amount: data.total_amount,
        total_currency: data.total_currency
      }
    };
    res.status(200).json(shortJson);

  } catch (error) {
    console.error('Duffel API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Duffel API failed',
      url: baseUrl,
      detail: error.response?.data || error.message
    });
  }
};

const fullOffers = async (req, res) => {
  const offerId = req.query.offer_id;
  const baseUrl = `${duffel_api_url}/air/offers/${offerId}`;

  try {
    const response = await axios.get(baseUrl, {
      headers: {
        'Accept-Encoding': 'gzip',
        'Accept': 'application/json',
        'Duffel-Version': 'v2',
        'Authorization': `Bearer ${duffel_access_tokens}`
      }
    });

    
    res.status(200).json(response.data);

  } catch (error) {
    
    console.error('Duffel API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Duffel API failed',
      url:baseUrl,
      detail: error.response?.data || error.message
    });
  }
};


// const offers = async (req, res) => {
//   const offerId = req.params.id;
//   const baseUrl = `${duffel_api_url}/air/offers/${offerId}`;

//   try {
//     const response = await axios.get(baseUrl, {
//       headers: {
//         'Accept-Encoding': 'gzip',
//         'Accept': 'application/json',
//         'Duffel-Version': 'v2',
//         'Authorization': `Bearer ${duffel_access_tokens}`
//       }
//     });

//     res.status(200).json(response.data);

//   } catch (error) {
//     console.error('Duffel API Error:', error.response?.data || error.message);
//     res.status(error.response?.status || 500).json({
//       error: 'Duffel API failed',
//       url: baseUrl,
//       detail: error.response?.data || error.message
//     });
//   }
// };

const createOrderLink = async (req, res) => {
    const requestData = req.body;
    if (!requestData || !requestData.data || !requestData.data.selected_offers || !requestData.data.passengers || !requestData.data.payments) {
      return res.status(400).json({ message: 'Invalid or incomplete flight booking data.' });
    }
    
    try {
      let bookingRef;
      let isUnique = false;

      // Try until we get a unique booking reference
      while (!isUnique) {
        bookingRef = `BOOK-${uuidv4().slice(0, 8).toUpperCase()}`;
        const [existing] = await pool.query(
          `SELECT 1 FROM ${dbPrefix}bookings WHERE booking_reference = ? LIMIT 1`,
          [bookingRef]
        );
        isUnique = existing.length === 0;
      }

      // Save booking
      const [result] = await pool.query(
        `INSERT INTO ${dbPrefix}bookings (booking_reference,booking_json,created_at)
         VALUES (?,?,NOW())`,
        [bookingRef,JSON.stringify(requestData)]
      );

      return res.status(201).json({
        success: true,
        message: 'Booking saved successfully',
        booking_reference: bookingRef,
        booking_id: result.insertId,
        booking_url: `${booking_base_url}?booking_ref=${bookingRef}`
      });
  } catch (err) {
    console.error('Error saving booking:', err);
    return res.status(500).json({ message: 'Server error',error:err });
  }

};


const saveOrderAmount = async (req, res) => {
    try {
        // 🔽 1. Extract request body
        const requestData = req.body.data;

        // 🔍 2. Validate input
        if (
            !requestData ||
            !requestData.booking_id ||
            !requestData.flight_offers ||
            !requestData.base_amount ||
            !requestData.tax_amount ||
            !requestData.total_amount ||
            !requestData.currency
        ) {
            return res.status(400).json({ error: 'Missing required fields', requestData });
        }

        // 🛠️ 3. Build SQL Query
        const query = `
            UPDATE ${dbPrefix}bookings
            SET 
                flight_offers = ?,
                amount = ?, 
                currency = ?, 
                updated_at = NOW()
            WHERE id = ?
        `;

        // 🔄 4. Execute query with parameters
        const [result] = await pool.query(query, [
            JSON.stringify(requestData.flight_offers),
            requestData.total_amount,
            requestData.currency,
            requestData.booking_id
        ]);

        // 📦 5. Check update success
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Booking ID not found' });
        }

        // ✅ 6. Success response
        res.json({ success: true, message: 'Offer updated successfully' });

    } catch (err) {
        console.error('Update Error:', err);
        res.status(500).json({ error: 'Database error', detail: err.message });
    }
};
//with offer link save data
// const createOrderLink = async (req, res) => {
//   const requestData = req.body;
//   const offerId = requestData?.data?.selected_offers?.[0];

//   if (
//     !requestData || 
//     !offerId || 
//     !requestData.data.passengers || 
//     !requestData.data.payments
//   ) {
//     return res.status(400).json({ message: 'Invalid or incomplete flight booking data.' });
//   }

//   try {
//     // Step 1: Fetch Offer Details from Duffel API
//     const duffelResponse = await axios.get(`${duffel_api_url}/air/offers/${offerId}`, {
//       headers: {
//         'Accept-Encoding': 'gzip',
//         'Accept': 'application/json',
//         'Duffel-Version': 'v2',
//         'Authorization': `Bearer ${duffel_access_tokens}`
//       }
//     });

//     const flightOfferData = duffelResponse.data;

//     // Step 2: Generate unique booking reference
//     let bookingRef;
//     let isUnique = false;

//     while (!isUnique) {
//       bookingRef = `BOOK-${uuidv4().slice(0, 8).toUpperCase()}`;
//       const [existing] = await pool.query(
//         `SELECT 1 FROM ${dbPrefix}bookings WHERE booking_reference = ? LIMIT 1`,
//         [bookingRef]
//       );
//       isUnique = existing.length === 0;
//     }

//     // Step 3: Save booking data + offer data in database
//     const [result] = await pool.query(
//       `INSERT INTO ${dbPrefix}bookings (booking_reference, booking_json, flight_offers, created_at)
//        VALUES (?, ?, ?, NOW())`,
//       [
//         bookingRef,
//         JSON.stringify(requestData),
//         JSON.stringify(flightOfferData)
//       ]
//     );

//     // Step 4: Return response
//     return res.status(201).json({
//       success: true,
//       message: 'Booking saved successfully',
//       booking_reference: bookingRef,
//       booking_id: result.insertId,
//       booking_url: `${booking_base_url}?booking_ref=${bookingRef}`
//     });

//   } catch (err) {
//     console.error('Error saving booking:', err.response?.data || err);
//     return res.status(500).json({ message: 'Server error', error: err.message || err });
//   }
// };

const createConformOrder = async (req, res) => {
  try {
    const requestData = req.body;
    const id = requestData.id;
    const data = requestData.data;
    
    // Check if this is a round-trip booking (has combined offer ID)
    const selectedOfferId = data.selected_offers[0];
    const isRoundTrip = selectedOfferId && selectedOfferId.startsWith('rt_');
    
    if (isRoundTrip) {
      console.log('🔄 Processing round-trip as 2 separate Duffel bookings');
      
      // Extract departure and return offer IDs from combined ID
      // Format: rt_departureOfferId_returnOfferId
      const offerParts = selectedOfferId.replace('rt_', '').split('_');
      if (offerParts.length < 2) {
        throw new Error('Invalid round-trip offer ID format');
      }
      
      const departureOfferId = offerParts[0];
      const returnOfferId = offerParts.slice(1).join('_'); // Handle IDs with underscores
      
      console.log(`Booking departure: ${departureOfferId}, return: ${returnOfferId}`);
      
      // Create departure booking
      const departureData = {
        ...data,
        selected_offers: [departureOfferId]
      };
      
      const departureResponse = await axios.post(
        `${duffel_api_url}/air/orders`,
        { data: departureData },
        {
          headers: {
            'Authorization': `Bearer ${duffel_access_tokens}`,
            'Accept-Encoding': 'gzip',
            'Accept': 'application/json',
            'Duffel-Version': 'v2',
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Create return booking  
      const returnData = {
        ...data,
        selected_offers: [returnOfferId]
      };
      
      const returnResponse = await axios.post(
        `${duffel_api_url}/air/orders`,
        { data: returnData },
        {
          headers: {
            'Authorization': `Bearer ${duffel_access_tokens}`,
            'Accept-Encoding': 'gzip',
            'Accept': 'application/json',
            'Duffel-Version': 'v2',
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Combine both bookings into unified response
      const combinedOrderJson = {
        trip_type: 'round_trip',
        departure_booking: departureResponse.data,
        return_booking: returnResponse.data,
        combined_reference: `${departureResponse.data.data.booking_reference}_${returnResponse.data.data.booking_reference}`,
        total_amount: (
          parseFloat(departureResponse.data.data.total_amount) + 
          parseFloat(returnResponse.data.data.total_amount)
        ).toFixed(2),
        currency: departureResponse.data.data.total_currency,
        created_at: new Date().toISOString()
      };
      
      // Update database with combined booking
      const query = `
        UPDATE ${dbPrefix}bookings
        SET 
            conform_order_json = ?,
            updated_at = NOW()
        WHERE id = ?
      `;
      
      await pool.query(query, [
        JSON.stringify(combinedOrderJson),
        id
      ]);
      
      // Return unified response that looks like single booking to frontend
      res.status(200).json({
        data: {
          id: combinedOrderJson.combined_reference,
          booking_reference: combinedOrderJson.combined_reference,
          total_amount: combinedOrderJson.total_amount,
          total_currency: combinedOrderJson.currency,
          slices: [
            ...departureResponse.data.data.slices,
            ...returnResponse.data.data.slices
          ],
          passengers: departureResponse.data.data.passengers,
          conditions: departureResponse.data.data.conditions,
          trip_type: 'round_trip'
        }
      });
      
    } else {
      // One-way booking (original logic)
      console.log('✈️ Processing one-way booking');
      
      const response = await axios.post(
        `${duffel_api_url}/air/orders`,
        {data},
        {
          headers: {
            'Authorization': `Bearer ${duffel_access_tokens}`,
            'Accept-Encoding': 'gzip',
            'Accept': 'application/json',
            'Duffel-Version': 'v2',
            'Content-Type': 'application/json'
          }
        }
      );

      // ✅ Save this Duffel response
      const conformOrderJson = response.data;

      // 🛠️ Update database
      const query = `
        UPDATE ${dbPrefix}bookings
        SET 
            conform_order_json = ?,
            updated_at = NOW()
        WHERE id = ?
      `;

      await pool.query(query, [
        JSON.stringify(conformOrderJson),
        id
      ]);

      // Return Duffel's success response
      res.status(response.status).json(conformOrderJson);
    }

  } catch (error) {
    console.error('Create conform order error:', error.message);
    // Return Duffel error as-is
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        error: true,
        message: error.message
      });
    }
  }
};


module.exports = {
  placesSuggestions,
  offerRequests,
  offerRequestsMultidate,
  offers,
  fullOffers,
  createOrderLink,
  createConformOrder,
  saveOrderAmount
};
