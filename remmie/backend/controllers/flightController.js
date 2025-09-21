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
      
      // Debug logging for one-way flights
      console.log(`🔄 One-Way Flight Search Response Summary:`);
      console.log(`   Total offers: ${filteredResponse.data?.offers?.length || 0}`);
      if (filteredResponse.data?.offers?.length > 0) {
        console.log(`   Sample offer structure:`, {
          id: filteredResponse.data.offers[0].id,
          total_amount: filteredResponse.data.offers[0].total_amount,
          total_currency: filteredResponse.data.offers[0].total_currency,
          trip_type: 'one_way',
          hasSlices: !!filteredResponse.data.offers[0].slices
        });
      }
      
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
    console.log(`🔄 Flight Search Response Summary:`);
    console.log(`   Trip type: ${slices.length === 1 ? 'One-way' : 'Round-trip'}`);
    console.log(`   Total offers: ${combinedOffers.length}`);
    if (combinedOffers.length > 0) {
      console.log(`   Sample offer structure:`, {
        id: combinedOffers[0].id,
        total_amount: combinedOffers[0].total_amount,
        total_currency: combinedOffers[0].total_currency,
        trip_type: combinedOffers[0].trip_type || 'one_way',
        hasOwner: !!combinedOffers[0].owner,
        hasSlices: !!combinedOffers[0].slices
      });
    }

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
        
        // Individual pricing (total calculated when both selected)
        departure_price: departureOffer.total_amount,
        return_price: returnOffer.total_amount,
        total_amount: combinedPrice.toFixed(2), // Add combined total_amount for consistency
        total_currency: departureOffer.total_currency || returnOffer.total_currency,
        
        // Add owner field for consistency with one-way offers
        owner: departureOffer.owner || { name: departureOffer.slices?.[0]?.segments?.[0]?.marketing_carrier?.name || "Unknown Airline" },
        
        // Add base_amount and tax_amount for consistency
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
        
        // Detailed departure and return flight information for N8N
        departure_details: {
          airline: departureOffer.owner?.name || departureOffer.slices?.[0]?.segments?.[0]?.marketing_carrier?.name || "Unknown Airline",
          flight_number: departureOffer.slices?.[0]?.segments?.[0]?.marketing_carrier_flight_number || "",
          departure_time: departureOffer.slices?.[0]?.segments?.[0]?.departing_at || "",
          arrival_time: departureOffer.slices?.[0]?.segments?.[0]?.arriving_at || "",
          price: departureOffer.total_amount,
          origin: departureOffer.slices?.[0]?.origin || {},
          destination: departureOffer.slices?.[0]?.destination || {}
        },
        return_details: {
          airline: returnOffer.owner?.name || returnOffer.slices?.[0]?.segments?.[0]?.marketing_carrier?.name || "Unknown Airline",
          flight_number: returnOffer.slices?.[0]?.segments?.[0]?.marketing_carrier_flight_number || "",
          departure_time: returnOffer.slices?.[0]?.segments?.[0]?.departing_at || "",
          arrival_time: returnOffer.slices?.[0]?.segments?.[0]?.arriving_at || "",
          price: returnOffer.total_amount,
          origin: returnOffer.slices?.[0]?.origin || {},
          destination: returnOffer.slices?.[0]?.destination || {}
        },
        
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
  
  // Sort by combined price (cheapest first)
  return roundTripPairs.sort((a, b) => {
    const aTotalPrice = parseFloat(a.departure_price) + parseFloat(a.return_price);
    const bTotalPrice = parseFloat(b.departure_price) + parseFloat(b.return_price);
    return aTotalPrice - bTotalPrice;
  });
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
  
  // Check if this is a round-trip combined offer ID
  const isRoundTrip = offerId && offerId.startsWith('rt_');
  
  if (isRoundTrip) {
    console.log('🔄 Get Offer Details: Processing round-trip combined ID:', offerId);
    
    try {
      // Extract departure and return offer IDs from combined ID
      // Format: rt_departureOfferId_returnOfferId
      // Duffel IDs start with "off_" so we need to find the second occurrence
      const withoutPrefix = offerId.replace('rt_', '');
      const secondOffIndex = withoutPrefix.indexOf('_off_');
      
      if (secondOffIndex === -1) {
        return res.status(400).json({
          error: 'Invalid round-trip offer ID format - cannot find second offer ID',
          provided: offerId
        });
      }
      
      const departureOfferId = withoutPrefix.substring(0, secondOffIndex);
      const returnOfferId = withoutPrefix.substring(secondOffIndex + 1); // Skip the underscore
      
      console.log(`   Fetching details for departure: ${departureOfferId}, return: ${returnOfferId}`);
      
      // Fetch both offers in parallel
      const [departureResponse, returnResponse] = await Promise.all([
        axios.get(`${duffel_api_url}/air/offers/${departureOfferId}`, {
          headers: {
            'Accept-Encoding': 'gzip',
            'Accept': 'application/json',
            'Duffel-Version': 'v2',
            'Authorization': `Bearer ${duffel_access_tokens}`
          }
        }),
        axios.get(`${duffel_api_url}/air/offers/${returnOfferId}`, {
          headers: {
            'Accept-Encoding': 'gzip',
            'Accept': 'application/json',
            'Duffel-Version': 'v2',
            'Authorization': `Bearer ${duffel_access_tokens}`
          }
        })
      ]);
      
      // Process and combine the data like the original offers endpoint
      const departureData = departureResponse.data.data;
      const returnData = returnResponse.data.data;
      
      // Combine slices from both flights
      const combinedSlices = [
        ...departureData.slices.map(slice => ({
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
        })),
        ...returnData.slices.map(slice => ({
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
        }))
      ];
      
      // Combine passengers from both flights (should be the same)
      const combinedPassengers = departureData.passengers.map(p => ({
        loyalty_programme_accounts: p.loyalty_programme_accounts || [],
        family_name: p.family_name || null,
        given_name: p.given_name || null,
        age: p.age || null,
        type: p.type || null,
        passengers_id: p.id || null
      }));
      
      // Calculate combined totals
      const combinedTotal = (
        parseFloat(departureData.total_amount) + 
        parseFloat(returnData.total_amount)
      ).toFixed(2);
      
      console.log(`🔢 Combined offer details totals:`);
      console.log(`   Departure: ${departureData.total_amount}`);
      console.log(`   Return: ${returnData.total_amount}`);
      console.log(`   Combined: ${combinedTotal}`);
      
      const combinedResponse = {
        data: {
          id: offerId,
          slices: combinedSlices,
          owner: departureData.owner,
          conditions: departureData.conditions,
          passengers: combinedPassengers,
          total_amount: combinedTotal,
          total_currency: departureData.total_currency,
          trip_type: 'round_trip'
        }
      };
      
      res.status(200).json(combinedResponse);
      
    } catch (error) {
      console.error('Round-trip offer details error:', error.message);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch round-trip offer details',
        detail: error.response?.data || error.message
      });
    }
    
  } else {
    // One-way offer (original logic)
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
  }
};

const fullOffers = async (req, res) => {
  const offerId = req.query.offer_id;
  const bookingRef = req.query.booking_ref;
  
  // Check if this is a round-trip combined offer ID
  const isRoundTrip = offerId && offerId.startsWith('rt_');
  
  // If no offer_id but booking_ref provided, check for round-trip session
  if (!offerId && bookingRef) {
    console.log('🔍 Checking booking reference for round-trip session:', bookingRef);
    
    try {
      // Check if this booking is part of a round-trip session
      const [bookingInfo] = await pool.query(
        `SELECT round_trip_session_id, round_trip_type FROM ${dbPrefix}bookings 
         WHERE booking_reference = ? AND round_trip_session_id IS NOT NULL LIMIT 1`,
        [bookingRef]
      );
      
      if (bookingInfo.length > 0) {
        console.log('🔄 Found round-trip session booking:', bookingInfo[0]);
        
        // Get both bookings in the session
        const [sessionBookings] = await pool.query(
          `SELECT booking_reference, booking_json, round_trip_type FROM ${dbPrefix}bookings 
           WHERE round_trip_session_id = ? ORDER BY created_at ASC`,
          [bookingInfo[0].round_trip_session_id]
        );
        
        if (sessionBookings.length === 2) {
          const departureBooking = sessionBookings.find(b => b.round_trip_type === 'departure');
          const returnBooking = sessionBookings.find(b => b.round_trip_type === 'return');
          
          const departureData = JSON.parse(departureBooking.booking_json);
          const returnData = JSON.parse(returnBooking.booking_json);
          
          const departureOfferId = departureData.data.selected_offers[0];
          const returnOfferId = returnData.data.selected_offers[0];
          
          console.log(`🔄 Processing round-trip session: departure=${departureOfferId}, return=${returnOfferId}`);
          
          // Fetch both offers from Duffel API
          const [departureResponse, returnResponse] = await Promise.all([
            axios.get(`${duffel_api_url}/air/offers/${departureOfferId}`, {
              headers: {
                'Accept-Encoding': 'gzip',
                'Accept': 'application/json',
                'Duffel-Version': 'v2',
                'Authorization': `Bearer ${duffel_access_tokens}`
              }
            }),
            axios.get(`${duffel_api_url}/air/offers/${returnOfferId}`, {
              headers: {
                'Accept-Encoding': 'gzip',
                'Accept': 'application/json',
                'Duffel-Version': 'v2',
                'Authorization': `Bearer ${duffel_access_tokens}`
              }
            })
          ]);
          
          const departureTotal = parseFloat(departureResponse.data.data.total_amount);
          const returnTotal = parseFloat(returnResponse.data.data.total_amount);
          const combinedTotal = (departureTotal + returnTotal).toFixed(2);
          
          console.log(`🔢 Round-trip session pricing:`);
          console.log(`   Departure: ${departureTotal}`);
          console.log(`   Return: ${returnTotal}`);
          console.log(`   Combined: ${combinedTotal}`);
          
          const combinedOffer = {
            data: {
              id: `rt_session_${bookingInfo[0].round_trip_session_id}`,
              trip_type: 'round_trip_session',
              total_amount: combinedTotal,
              total_currency: departureResponse.data.data.total_currency,
              base_amount: (parseFloat(departureResponse.data.data.base_amount) + parseFloat(returnResponse.data.data.base_amount)).toFixed(2),
              tax_amount: (parseFloat(departureResponse.data.data.tax_amount) + parseFloat(returnResponse.data.data.tax_amount)).toFixed(2),
              slices: [...departureResponse.data.data.slices, ...returnResponse.data.data.slices],
              passengers: departureResponse.data.data.passengers,
              conditions: departureResponse.data.data.conditions,
              expires_at: new Date(Math.min(new Date(departureResponse.data.data.expires_at).getTime(), new Date(returnResponse.data.data.expires_at).getTime())),
              round_trip_session_id: bookingInfo[0].round_trip_session_id
            }
          };
          
          return res.status(200).json(combinedOffer);
        }
      }
    } catch (error) {
      console.error('Error checking round-trip session:', error.message);
      // Continue to regular offer processing
    }
  }
  
  if (isRoundTrip) {
    console.log('🔄 Fetching round-trip offer details for combined ID:', offerId);
    
    try {
      // Extract departure and return offer IDs from combined ID
      // Format: rt_departureOfferId_returnOfferId
      // Duffel IDs start with "off_" so we need to find the second occurrence
      const withoutPrefix = offerId.replace('rt_', '');
      const secondOffIndex = withoutPrefix.indexOf('_off_');
      
      if (secondOffIndex === -1) {
        return res.status(400).json({
          error: 'Invalid round-trip offer ID format - cannot find second offer ID',
          provided: offerId
        });
      }
      
      const departureOfferId = withoutPrefix.substring(0, secondOffIndex);
      const returnOfferId = withoutPrefix.substring(secondOffIndex + 1); // Skip the underscore
      
      console.log(`Fetching departure: ${departureOfferId}, return: ${returnOfferId}`);
      
      // Fetch both offers in parallel
      const [departureResponse, returnResponse] = await Promise.all([
        axios.get(`${duffel_api_url}/air/offers/${departureOfferId}`, {
          headers: {
            'Accept-Encoding': 'gzip',
            'Accept': 'application/json',
            'Duffel-Version': 'v2',
            'Authorization': `Bearer ${duffel_access_tokens}`
          }
        }),
        axios.get(`${duffel_api_url}/air/offers/${returnOfferId}`, {
          headers: {
            'Accept-Encoding': 'gzip',
            'Accept': 'application/json',
            'Duffel-Version': 'v2',
            'Authorization': `Bearer ${duffel_access_tokens}`
          }
        })
      ]);
      
      // Calculate combined totals
      const departureTotal = parseFloat(departureResponse.data.data.total_amount);
      const returnTotal = parseFloat(returnResponse.data.data.total_amount);
      const combinedTotal = (departureTotal + returnTotal).toFixed(2);
      
      console.log(`🔢 Round-trip pricing calculation:`);
      console.log(`   Departure total: ${departureTotal}`);
      console.log(`   Return total: ${returnTotal}`);
      console.log(`   Combined total: ${combinedTotal}`);
      
      // Note: requestData is not available in fullOffers context
      // This pricing mismatch check will be done in the booking creation phase instead
      
      // Combine both offers into a unified response that looks like a single offer
      const combinedOffer = {
        data: {
          id: offerId, // Use the combined ID
          trip_type: 'round_trip',
          total_amount: combinedTotal,
          total_currency: departureResponse.data.data.total_currency,
          base_amount: (
            parseFloat(departureResponse.data.data.base_amount) + 
            parseFloat(returnResponse.data.data.base_amount)
          ).toFixed(2),
          tax_amount: (
            parseFloat(departureResponse.data.data.tax_amount) + 
            parseFloat(returnResponse.data.data.tax_amount)
          ).toFixed(2),
          slices: [
            ...departureResponse.data.data.slices,
            ...returnResponse.data.data.slices
          ],
          passengers: departureResponse.data.data.passengers,
          conditions: departureResponse.data.data.conditions,
          expires_at: new Date(Math.min(
            new Date(departureResponse.data.data.expires_at).getTime(),
            new Date(returnResponse.data.data.expires_at).getTime()
          )).toISOString(),
          // Store original offers for reference
          _departure_offer: departureResponse.data.data,
          _return_offer: returnResponse.data.data
        }
      };
      
      res.status(200).json(combinedOffer);
      
    } catch (error) {
      console.error('Round-trip offer fetch error:', error.message);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch round-trip offer details',
        detail: error.response?.data || error.message
      });
    }
    
  } else {
    // One-way offer (original logic)
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
        url: baseUrl,
        detail: error.response?.data || error.message
      });
    }
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
    
    const selectedOfferId = requestData.data.selected_offers[0];
    const isRoundTrip = selectedOfferId && selectedOfferId.startsWith('rt_');
    let roundTripSessionId = requestData.data.round_trip_session_id;
    let roundTripType = requestData.data.round_trip_type;
    let isRoundTripBooking = roundTripSessionId && roundTripType;
    
    // HANDLE OLD N8N: If N8N sends combined rt_ ID, split it and create 2 bookings
    if (isRoundTrip && !roundTripSessionId) {
      console.log(`⚠️  Old N8N system detected - combined rt_ offer without session ID`);
      console.log(`   Will split into 2 separate bookings with auto-generated session`);
      
      // Generate session ID for this round-trip
      roundTripSessionId = `rt_n8n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Split the combined ID correctly
      const withoutPrefix = selectedOfferId.replace('rt_', '');
      const secondOffIndex = withoutPrefix.indexOf('_off_');
      
      if (secondOffIndex > 0) {
        const departureOfferId = withoutPrefix.substring(0, secondOffIndex);
        const returnOfferId = withoutPrefix.substring(secondOffIndex + 1);
        
        console.log(`   Split IDs: departure=${departureOfferId}, return=${returnOfferId}`);
        
        // Modify request to use departure offer ID and add session info
        requestData.data.selected_offers[0] = departureOfferId;
        requestData.data.round_trip_session_id = roundTripSessionId;
        requestData.data.round_trip_type = 'departure';
        roundTripType = 'departure';
        isRoundTripBooking = true;
        
        // We'll need to create the return booking separately
        // Store return info for later processing
        requestData._return_offer_id = returnOfferId;
        requestData._needs_return_booking = true;
        
        // If N8N sent total amount, split it between the two bookings
        const totalAmount = parseFloat(requestData.data.payments?.[0]?.amount || 0);
        if (totalAmount > 500) {
          console.log(`   N8N sent total amount: ${totalAmount}, will split between bookings`);
          requestData.data.payments[0].amount = (totalAmount / 2).toFixed(2);
          requestData._return_amount = (totalAmount / 2).toFixed(2);
        }
      }
    }
    
    const needsAutoLinking = !isRoundTrip && !roundTripSessionId && false; // Disabled auto-linking
    
    // AUTO-LINK DETECTION: Check if this might be part of a round-trip booking
    // DISABLED: Auto-linking is causing issues with N8N's current behavior
    // Only auto-link if explicitly enabled
    const AUTO_LINKING_ENABLED = false;
    
    if (AUTO_LINKING_ENABLED && needsAutoLinking) {
      const userEmail = requestData.data.passengers[0]?.email;
      if (userEmail) {
        console.log(`🔍 Checking for potential round-trip auto-linking for user: ${userEmail}`);
        
        // Look for recent bookings by the same user (within last 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const [recentBookings] = await pool.query(
          `SELECT * FROM ${dbPrefix}bookings 
           WHERE JSON_EXTRACT(booking_json, '$.data.passengers[0].email') = ? 
           AND created_at >= ? 
           AND round_trip_session_id IS NULL
           AND booking_reference NOT LIKE 'rt_%'
           ORDER BY created_at DESC LIMIT 5`,
          [userEmail, tenMinutesAgo.toISOString().slice(0, 19).replace('T', ' ')]
        );
        
        console.log(`   Found ${recentBookings.length} recent bookings for auto-linking`);
        
        // Only auto-link if we have exactly 1 recent booking and it's not a combined rt_ booking
        if (recentBookings.length === 1) {
          const firstBooking = recentBookings[0];
          const firstBookingData = JSON.parse(firstBooking.booking_json);
          const firstOfferId = firstBookingData.data.selected_offers[0];
          
          // Don't auto-link if the first booking was already a combined rt_ offer
          if (!firstOfferId.startsWith('rt_')) {
            // Generate auto-session ID
            const autoSessionId = `rt_auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            console.log(`🔗 Auto-linking potential round-trip bookings:`);
            console.log(`   First booking: ${firstBooking.booking_reference} (${firstOfferId})`);
            console.log(`   Current booking: will be linked with session ${autoSessionId}`);
            
            // Update the first booking with session info
            await pool.query(
              `UPDATE ${dbPrefix}bookings 
               SET round_trip_session_id = ?, round_trip_type = 'departure' 
               WHERE id = ?`,
              [autoSessionId, firstBooking.id]
            );
            
            // Set current booking as return
            requestData.data.round_trip_session_id = autoSessionId;
            requestData.data.round_trip_type = 'return';
            
            console.log(`✅ Auto-linked bookings with session ID: ${autoSessionId}`);
          }
        }
      }
    } else if (needsAutoLinking) {
      console.log(`⚠️ Auto-linking disabled - treating as individual booking`);
    }
    
    console.log(`📝 Creating booking order link:`);
    console.log(`   Selected offer ID: ${selectedOfferId}`);
    console.log(`   Is round-trip: ${isRoundTrip}`);
    console.log(`   Round-trip session ID: ${roundTripSessionId}`);
    console.log(`   Round-trip type: ${roundTripType}`);
    console.log(`   Is round-trip booking: ${isRoundTripBooking}`);
    console.log(`   Passengers: ${requestData.data.passengers.length}`);
    
    // 🔍 Smart N8N Total Amount Detection
    const n8nAmount = parseFloat(requestData.data.payments?.[0]?.amount || 0);
    console.log(`💰 N8N provided amount: ${n8nAmount}`);
    
    // Check if this might be a round-trip total amount being sent to individual booking
    if (n8nAmount > 500 && !isRoundTrip && (roundTripSessionId || needsAutoLinking)) {
        console.log(`🔍 Possible N8N round-trip total detected: ${n8nAmount} (individual booking but high amount)`);
    }
    
    console.log(`   Request data:`, JSON.stringify(requestData, null, 2));
    
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

      // Save booking with round-trip session info if applicable
      let insertQuery, insertValues;
      
      if (isRoundTripBooking) {
        insertQuery = `INSERT INTO ${dbPrefix}bookings (booking_reference, booking_json, round_trip_session_id, round_trip_type, created_at)
                       VALUES (?, ?, ?, ?, NOW())`;
        insertValues = [bookingRef, JSON.stringify(requestData), roundTripSessionId, roundTripType];
        
        console.log(`🔗 Saving round-trip booking part:`);
        console.log(`   Session ID: ${roundTripSessionId}`);
        console.log(`   Type: ${roundTripType}`);
      } else {
        insertQuery = `INSERT INTO ${dbPrefix}bookings (booking_reference, booking_json, created_at)
                       VALUES (?, ?, NOW())`;
        insertValues = [bookingRef, JSON.stringify(requestData)];
      }
      
      const [result] = await pool.query(insertQuery, insertValues);
      
      // If this was a split rt_ booking, create the return booking now
      if (requestData._needs_return_booking && requestData._return_offer_id) {
        console.log(`🔄 Creating automatic return booking for split rt_ ID`);
        
        // Create return booking data
        const returnBookingData = JSON.parse(JSON.stringify(requestData));
        returnBookingData.data.selected_offers[0] = requestData._return_offer_id;
        returnBookingData.data.round_trip_type = 'return';
        
        // Use the return amount if it was split
        if (requestData._return_amount) {
          returnBookingData.data.payments[0].amount = requestData._return_amount;
        }
        
        delete returnBookingData._needs_return_booking;
        delete returnBookingData._return_offer_id;
        delete returnBookingData._return_amount;
        
        // Generate return booking reference
        let returnBookingRef;
        let isUniqueReturn = false;
        while (!isUniqueReturn) {
          returnBookingRef = `BOOK-${uuidv4().slice(0, 8).toUpperCase()}`;
          const [existingReturn] = await pool.query(
            `SELECT 1 FROM ${dbPrefix}bookings WHERE booking_reference = ? LIMIT 1`,
            [returnBookingRef]
          );
          isUniqueReturn = existingReturn.length === 0;
        }
        
        // Save return booking
        await pool.query(
          `INSERT INTO ${dbPrefix}bookings (booking_reference, booking_json, round_trip_session_id, round_trip_type, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [returnBookingRef, JSON.stringify(returnBookingData), roundTripSessionId, 'return']
        );
        
        console.log(`✅ Auto-created return booking: ${returnBookingRef}`);
        
        // Return the departure booking reference for checkout (it will handle both)
        return res.status(201).json({
          success: true,
          message: 'Round-trip booking completed successfully (auto-split)',
          booking_reference: bookingRef,
          booking_id: result.insertId,
          booking_url: `${booking_base_url}?booking_ref=${bookingRef}`,
          round_trip_session_id: roundTripSessionId,
          is_round_trip_complete: true
        });
      }
      
      // For round-trip bookings, check if this completes the pair
      if (isRoundTripBooking) {
        const [sessionBookings] = await pool.query(
          `SELECT booking_reference, round_trip_type FROM ${dbPrefix}bookings 
           WHERE round_trip_session_id = ? ORDER BY created_at ASC`,
          [roundTripSessionId]
        );
        
        console.log(`🔍 Round-trip session bookings found: ${sessionBookings.length}`);
        
        if (sessionBookings.length === 2) {
          // Both departure and return bookings are complete
          const departureBooking = sessionBookings.find(b => b.round_trip_type === 'departure');
          const returnBooking = sessionBookings.find(b => b.round_trip_type === 'return');
          
          console.log(`✅ Round-trip complete! Departure: ${departureBooking.booking_reference}, Return: ${returnBooking.booking_reference}`);
          
          // Return the departure booking reference for checkout (it will handle both)
          return res.status(201).json({
            success: true,
            message: 'Round-trip booking completed successfully',
            booking_reference: departureBooking.booking_reference,
            booking_id: result.insertId,
            booking_url: `${booking_base_url}?booking_ref=${departureBooking.booking_reference}`,
            round_trip_session_id: roundTripSessionId,
            is_round_trip_complete: true
          });
        } else {
          // Only one part of round-trip is complete
          console.log(`⏳ Round-trip partial (${roundTripType} completed)`);
          
          return res.status(201).json({
            success: true,
            message: `Round-trip ${roundTripType} booking saved, waiting for ${roundTripType === 'departure' ? 'return' : 'departure'}`,
            booking_reference: bookingRef,
            booking_id: result.insertId,
            round_trip_session_id: roundTripSessionId,
            is_round_trip_complete: false
          });
        }
      } else {
        // Regular one-way booking
        return res.status(201).json({
          success: true,
          message: 'Booking saved successfully',
          booking_reference: bookingRef,
          booking_id: result.insertId,
          booking_url: `${booking_base_url}?booking_ref=${bookingRef}`
        });
      }
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

        console.log(`💰 Saving booking amount:`);
        console.log(`   Booking ID: ${requestData.booking_id}`);
        console.log(`   Total amount: ${requestData.total_amount}`);
        console.log(`   Currency: ${requestData.currency}`);
        
        // 🔍 Check if this booking is part of a round-trip session
        const [sessionCheck] = await pool.query(
            `SELECT round_trip_session_id, round_trip_type FROM ${dbPrefix}bookings 
             WHERE id = ? AND round_trip_session_id IS NOT NULL`,
            [requestData.booking_id]
        );
        
        let finalAmount = requestData.total_amount;
        
        if (sessionCheck.length > 0) {
            const sessionId = sessionCheck[0].round_trip_session_id;
            const currentType = sessionCheck[0].round_trip_type;
            
            console.log(`🔄 Round-trip session detected: ${sessionId}, type: ${currentType}`);
            
            // Check if this is the return booking (second booking in the session)
            if (currentType === 'return') {
                console.log(`🔄 This is the return booking - checking for N8N total amount distribution`);
                
                // Get the departure booking to see if we need to redistribute the total
                const [departureBooking] = await pool.query(
                    `SELECT amount FROM ${dbPrefix}bookings 
                     WHERE round_trip_session_id = ? AND round_trip_type = 'departure'`,
                    [sessionId]
                );
                
                if (departureBooking.length > 0) {
                    const departureAmount = parseFloat(departureBooking[0].amount);
                    const returnAmount = parseFloat(requestData.total_amount);
                    const combinedAmount = departureAmount + returnAmount;
                    
                    console.log(`📊 Round-trip pricing analysis:`);
                    console.log(`   Departure booking amount: ${departureAmount}`);
                    console.log(`   Current return amount: ${returnAmount}`);
                    console.log(`   Combined would be: ${combinedAmount}`);
                    
                    // Check if N8N is providing a total that's different from individual sum
                    // This happens when N8N sends the total round-trip amount to the return booking
                    if (returnAmount > departureAmount * 1.5) {
                        console.log(`🔧 N8N total amount detected - redistributing pricing`);
                        
                        // This looks like N8N is sending the total round-trip amount
                        // Keep this as the total for the return booking (which becomes the checkout amount)
                        finalAmount = returnAmount;
                        
                        console.log(`✅ Using N8N's total amount: ${finalAmount}`);
                    }
                }
            }
        }
        
        // 🔄 4. Execute query with parameters
        const [result] = await pool.query(query, [
            JSON.stringify(requestData.flight_offers),
            finalAmount,
            requestData.currency,
            requestData.booking_id
        ]);

        // 📦 5. Check update success
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Booking ID not found' });
        }

        // ✅ 6. Success response
        console.log(`✅ Database updated successfully for booking ID: ${requestData.booking_id}`);
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
        duffel_departure_reference: departureResponse.data.data.booking_reference,
        duffel_return_reference: returnResponse.data.data.booking_reference,
        total_amount: (
          parseFloat(departureResponse.data.data.total_amount) + 
          parseFloat(returnResponse.data.data.total_amount)
        ).toFixed(2),
        currency: departureResponse.data.data.total_currency,
        created_at: new Date().toISOString(),
        // Create unified structure that looks like single booking
        data: {
          id: `RT_${departureResponse.data.data.id}_${returnResponse.data.data.id}`,
          booking_reference: `${departureResponse.data.data.booking_reference}_${returnResponse.data.data.booking_reference}`,
          total_amount: (
            parseFloat(departureResponse.data.data.total_amount) + 
            parseFloat(returnResponse.data.data.total_amount)
          ).toFixed(2),
          total_currency: departureResponse.data.data.total_currency,
          slices: [
            ...departureResponse.data.data.slices,
            ...returnResponse.data.data.slices
          ],
          passengers: departureResponse.data.data.passengers,
          conditions: departureResponse.data.data.conditions
        }
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
      res.status(200).json(combinedOrderJson);
      
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
