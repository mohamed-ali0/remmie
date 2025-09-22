import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as TablerIcons from '@tabler/icons-react';
import { Card, CardBody, Col, Container, Row, Form, Button, Alert } from 'react-bootstrap';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getToken,checkAndLogoutIfExpired } from '../utils/auth';
import OfferComponent from '../components/OfferComponent';


// Utility functions for formatting
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (duration) => {
  if (!duration) return '';
  // PT2H10M format to 2h 10m
  const matches = duration.match(/PT(\d+H)?(\d+M)?/);
  const hours = matches[1] ? matches[1].replace('H', 'h ') : '';
  const mins = matches[2] ? matches[2].replace('M', 'm') : '';
  return `${hours}${mins}`.trim();
};

const getPassengerTypeCount = (passengers) => {
  const counts = { adult: 0, child: 0, infant: 0 };
  passengers.forEach(p => {
    if (p.type === 'adult') counts.adult++;
    else if (p.type === 'child') counts.child++;
    else if (p.type === 'infant_without_seat') counts.infant++;
  });
  return counts;
};

const BookingCart = () => {
    const [startDate1, setStartDate1] = useState(null);
    const [startDate2, setStartDate2] = useState();
    const [startDate3, setStartDate3] = useState();
    const [startDate4, setStartDate4] = useState();
    const [startDate5, setStartDate5] = useState();
    const [startDate6, setStartDate6] = useState();
    const [startDate7, setStartDate7] = useState();
    const [startDate8, setStartDate8] = useState();
    const [startDate9, setStartDate9] = useState();
    const [startDate10, setStartDate10] = useState();

    const navigate = useNavigate();
    const [bookingRef, setBookingRef] = useState('');
    const [offerDetails, setOfferDetails] = useState(null);
    const [passengerDetails, setPassengerDetails] = useState([]);
    const [paymentDetails, setPaymentDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [paying, setPaying] = useState(false);
    const [isOfferExpired, setIsOfferExpired] = useState(false);
    
    const [validationErrors, setValidationErrors] = useState({});
    const [formData, setFormData] = useState({
        contact: {
            email: '',
            phone: ''
        },
        passengers: []
    });

    useEffect(() => {
        const fetchBooking = async () => {
            if (checkAndLogoutIfExpired(navigate)) return;

            const token = getToken();
            const params = new URLSearchParams(window.location.search);
            const ref = params.get('booking_ref');
            if (!ref) {
                setError('Booking reference missing in URL');
                setLoading(false);
                return;
            }
            setBookingRef(ref);

            try {
                // Step 1: Get booking details from your database
                const { data: bookingData } = await axios.post(
                    `${import.meta.env.VITE_API_BASE_URL}/api/booking/get-booking-byref`,
                    { booking_ref: ref },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                // Parse the booking_json from the database
                const bookingJson = typeof bookingData.booking_json === 'string' 
                    ? JSON.parse(bookingData.booking_json) 
                    : bookingData.booking_json;

                console.log('🔍 Booking data received:', {
                    booking_ref: ref,
                    is_round_trip: bookingData.is_round_trip,
                    round_trip_session_id: bookingData.round_trip_session_id,
                    round_trip_type: bookingData.round_trip_type,
                    has_companion: !!bookingData.companion_booking
                });

                // Extract passenger details from booking_json
                const passengers = bookingJson.data?.passengers || [];
                setPassengerDetails(bookingJson.data?.passengers || []);
                
                // Extract payment information
                if (bookingJson.data?.payments?.length > 0) {
                    setPaymentDetails(bookingJson.data.payments[0]);
                }

                // Initialize form data with existing passenger details
                setFormData({
                        contact: {
                            email: passengers[0]?.email || '',
                            phone: passengers[0]?.phone_number || ''
                        },
                        passengers: passengers.map(p => ({
                            id: p.id || '',
                            title: p.title || 'mr',
                            given_name: p.given_name || '',
                            family_name: p.family_name || '',
                            born_on: p.born_on ? new Date(p.born_on) : null,
                            gender: p.gender || 'm',
                            passport_country: p.passport_country || '',
                            passport_number: p.passport_number || '',
                            passport_expiry: p.passport_expiry ? new Date(p.passport_expiry) : null,
                            phone_number:p.phone_number,
                            email:p.email
                        }))
                    });

                // Step 2: Fetch offer details - handle round-trip vs one-way
                if (bookingJson.data?.selected_offers?.length > 0) {
                    let offerData;
                    let offerId = null; // Initialize offerId for both branches
                    
                    if (bookingData.is_round_trip && bookingData.companion_booking) {
                        console.log('🔄 Fetching round-trip offer details');
                        offerId = 'round-trip-session'; // Set identifier for round-trip
                        
                        // For round-trip, we need to fetch offers using the round-trip session
                        // The fullOffers endpoint can handle this with booking_ref parameter
                        const { data } = await axios.post(
                            `${import.meta.env.VITE_API_BASE_URL}/api/flight/full-offers?booking_ref=${ref}`,
                            {},
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        offerData = data;
                    } else {
                        console.log('✈️ Fetching one-way offer details');
                        
                        // For one-way, use the original logic
                        offerId = bookingJson.data.selected_offers[0];
                        const { data } = await axios.post(
                            `${import.meta.env.VITE_API_BASE_URL}/api/flight/full-offers?offer_id=${offerId}`,
                            {},
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        offerData = data;
                    }


                        // Check if offer is already expired
                        if (offerData?.data?.expires_at) {
                            const expiryTime = new Date(offerData.data.expires_at).getTime();
                            setIsOfferExpired(expiryTime < Date.now());
                        }
                        
                        console.log('🔍 Frontend: Processing offer data:');
                        console.log('   Offer ID:', offerId);
                        console.log('   Trip type:', offerData?.data?.trip_type);
                        console.log('   Base amount:', offerData?.data.base_amount);
                        console.log('   Tax amount:', offerData?.data.tax_amount);
                        console.log('   Total amount:', offerData?.data.total_amount);
                        console.log('   Currency:', offerData?.data.total_currency);
                        
                        // Send to backend
                       await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/flight/save-order-amount`, {
                          data: {
                            booking_id: bookingData.id,
                            flight_offers:offerData,
                            base_amount: offerData?.data.base_amount,
                            tax_amount: offerData?.data.tax_amount,
                            total_amount: offerData?.data.total_amount,
                            currency: offerData?.data.total_currency,
                          }
                        }, {
                          headers: {
                            'Content-Type': 'application/json'
                          }
                        });
                    setOfferDetails(offerData);

                }

            } catch (e) {
                console.error(e);
                setError(
                    e.response?.data?.message ||
                    'Failed to fetch booking details or not authorized'
                );
            } finally {
                setLoading(false);
            }
        };

        fetchBooking();
    }, [navigate]);
    
    const handleInputChange = (index, field, value) => {
        setFormData(prev => {
            const newPassengers = [...prev.passengers];
            if (field.includes('contact.')) {
                // Handle contact info changes
                const contactField = field.replace('contact.', '');
                return {
                    ...prev,
                    contact: {
                        ...prev.contact,
                        [contactField]: value
                    }
                };
            } else {
                // Handle passenger info changes
                newPassengers[index] = {
                    ...newPassengers[index],
                    [field]: value
                };
                return {
                    ...prev,
                    passengers: newPassengers
                };
            }
        });
    };

    const validatePassengerData = () => {
        const errors = {};
        let isValid = true;

        // Validate contact info
        if (!formData.contact.email || !/^\S+@\S+\.\S+$/.test(formData.contact.email)) {
            errors.contact_email = 'Valid email is required';
            isValid = false;
        }

        if (!formData.contact.phone || formData.contact.phone.length < 8) {
            errors.contact_phone = 'Valid phone number is required';
            isValid = false;
        }

        // Validate each passenger
        formData.passengers.forEach((passenger, index) => {
            const passengerErrors = {};
            const passengerType = offerDetails.data.passengers[index].type;

            // Required fields for all passenger types
            if (!passenger.given_name || passenger.given_name.trim() === '') {
                passengerErrors.given_name = 'Given name is required';
                isValid = false;
            }

            if (!passenger.family_name || passenger.family_name.trim() === '') {
                passengerErrors.family_name = 'Family name is required';
                isValid = false;
            }

            if (!passenger.born_on) {
                passengerErrors.born_on = 'Date of birth is required';
                isValid = false;
            } else {
                const today = new Date();
                const dob = new Date(passenger.born_on);
                const age = today.getFullYear() - dob.getFullYear();
                
                // Validate age based on passenger type
                if (passengerType === 'adult' && age < 16) {
                    passengerErrors.born_on = 'Adult must be at least 16 years old';
                    isValid = false;
                } else if (passengerType === 'child' && (age < 2 || age >= 12)) {
                    passengerErrors.born_on = 'Child must be between 2-11 years old';
                    isValid = false;
                } else if (passengerType === 'infant_without_seat' && age >= 2) {
                    passengerErrors.born_on = 'Infant must be under 2 years old';
                    isValid = false;
                }
            }

            // Validate passport details for international flights
            // (You might want to add this based on your flight routes)
            // if (!passenger.passport_number) {
            //     passengerErrors.passport_number = 'Passport number is required';
            //     isValid = false;
            // }

            if (Object.keys(passengerErrors).length > 0) {
                errors[`passenger_${index}`] = passengerErrors;
            }
        });

        setValidationErrors(errors);
        return isValid;
    };

    const handlePayNow = async () => {
        if (!validatePassengerData()) {
            const firstErrorElement = document.querySelector('.is-invalid');
            if (firstErrorElement) {
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        if (checkAndLogoutIfExpired(navigate)) return;
        const token = getToken();

        try {
            setPaying(true);

            // પહેલા formData.passengers માંથી basic passenger data તૈયાર કરો
            const rawPassengers = formData.passengers.map((passenger, index) => ({
                id: passenger.id,
                type: offerDetails.data.passengers[index].type,
                title: passenger.title,
                given_name: passenger.given_name,
                family_name: passenger.family_name,
                born_on: passenger.born_on.toISOString().split('T')[0], // YYYY-MM-DD
                gender: passenger.gender,
                phone_number: passenger.phone_number && passenger.phone_number.trim() !== ''
                    ? passenger.phone_number
                    : formData.contact.phone, // fallback
                email: passenger.email && passenger.email.trim() !== ''
                    ? passenger.email
                    : formData.contact.email,
            }));

            // adults અને infants અલગ કરો
            const adults = rawPassengers.filter(p => p.type === 'adult');
            const infants = rawPassengers.filter(p => p.type === 'infant_without_seat');

            // infants ને adults સાથે assign કરો (round robin: એક adult ને એક infant)
            let adultIndex = 0;
            infants.forEach(infant => {
                if (adults.length === 0) return; // જો adult ન હોય તો assign ન કરી શકીએ

                // adult ને infant assign કરો
                infants.infants_passenger_id = undefined; // infants ના field cleanup

                adults[adultIndex].infant_passenger_id = infant.id;
                adultIndex = (adultIndex + 1) % adults.length;
            });

            // હવે rawPassengers માં adults માં infant_passenger_id set કરો
            const passengersData = rawPassengers.map(p => {
                if (p.type === 'adult') {
                    // find infant assigned to this adult
                    const infantAssigned = adults.find(a => a.id === p.id)?.infant_passenger_id;
                    return {
                        ...p,
                        infant_passenger_id: infantAssigned || undefined
                    };
                }
                // infant_without_seat માં infant_passenger_id ના મૂકો (Duffel ના નોર્મ મુજબ)
                return p;
            });

            // Send data to backend
            const { data } = await axios.post(
                `${import.meta.env.VITE_API_BASE_URL}/api/stripe/create-flight-payment-session`,
                {
                    booking_ref: bookingRef,
                    contact: formData.contact,
                    passengers: passengersData,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            window.location.href = data.url;
        } catch (e) {
            console.error('Payment error', e);
            alert('Payment initiation failed. ' + (e.response?.data?.message || ''));
        } finally {
            setPaying(false);
        }
    };
    // const handlePayNow = async () => {
    //     if (checkAndLogoutIfExpired(navigate)) return;

    //     const token = getToken();
    //     try {
    //         setPaying(true);
    //         const { data } = await axios.post(
    //             `${import.meta.env.VITE_API_BASE_URL}/api/stripe/create-flight-payment-session`,
    //             { booking_ref: bookingRef },
    //             { headers: { Authorization: `Bearer ${token}` } }
    //         );

    //         window.location.href = data.url;
    //     } catch (e) {
    //         console.error('Payment error', e);
    //         alert('Payment initiation failed.');
    //     } finally {
    //         setPaying(false);
    //     }
    // };

    if (loading) return <p>Loading booking details...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;
    if (!offerDetails || !passengerDetails) return <p>No booking data found</p>;

    // Extract data from APIs
    const bookingData = offerDetails.data;
    const passengers = bookingData.passengers || [];
    const slices = bookingData.slices || [];
    const firstSlice = slices[0] || {};
    const returnSlice = slices[1] || {};
    const firstSegment = firstSlice.segments?.[0] || {};
    const returnSegment = returnSlice.segments?.[0] || {};
    
    const passengerCounts = getPassengerTypeCount(passengers);
    const totalPassengers = passengerCounts.adult + passengerCounts.child + passengerCounts.infant;
    const cabinClass = firstSegment.passengers?.[0]?.cabin_class_marketing_name || 'Economy';
    
    // Calculate dates for the trip
    const departureDate = firstSegment.departing_at;
    const returnDate = returnSegment.departing_at;

    return (
        <>
            <section className='space-pt-50 booking_sec'>

                <div className="container">

                    <div className='row gy-4 justify-content-center'>
                        <div className="col-lg-8">
                            <OfferComponent 
                                expiresAt={bookingData.expires_at} 
                                onExpiryChange={setIsOfferExpired}
                            />
                        </div>
                        <div className="col-lg-8">
                            <ul className="tag_list mb-3">
                                <li>{slices.length > 1 ? 'Return' : 'One Way'}</li>
                                {departureDate && returnDate && (
                                    <li>{formatDate(departureDate)} - {formatDate(returnDate)}</li>
                                )}
                                <li>{totalPassengers} Passengers</li>
                                <li>{cabinClass}</li>
                            </ul>
                            <h3 className='fw-bold'> 
                                {firstSegment.origin?.iata_code} <i className='ti ti-arrows-diff font_light'></i> {firstSegment.destination?.iata_code} 
                            </h3>
                            <p>This offer will expire on {formatDate(bookingData.payment_requirements?.price_guarantee_expires_at)}</p>

                            <h4 className='fw-bold mb-3'>Selected flights</h4>
                            
                            {/* Outbound Flight */}
                            {firstSlice && (
                                <div className='booking_card'>
                                    <div className='d-md-flex align-items-center justify-content-between'>
                                        <div className='d-flex align-items-start gap-sm-4 gap-2'>
                                            <div className='badge bg-primary p-2'>
                                                <i className='ti ti-plus fs-6'></i>
                                            </div>
                                            <div>
                                                <h5 className='fw-semibold'>
                                                    <span>{formatDate(firstSegment.departing_at)}</span> 
                                                    <span>{formatTime(firstSegment.departing_at)} - {formatTime(firstSegment.arriving_at)}</span>
                                                </h5>
                                                <p className='font_light'>{cabinClass} - {firstSegment.marketing_carrier?.name}</p>
                                            </div>
                                        </div>
                                        <div className='time_detail'>
                                            <div className=''>
                                                <h5 className='fw-semibold'>
                                                    <span>{formatTime(firstSegment.departing_at)} - {formatTime(firstSegment.arriving_at)}</span>
                                                </h5>
                                                <p className='font_light'>{firstSegment.origin?.iata_code} - {firstSegment.destination?.iata_code}</p>
                                            </div>
                                            <div className=''>
                                                <h5 className='fw-semibold'>
                                                    <span>{formatDuration(firstSegment.duration)}</span>
                                                </h5>
                                                <p className='font_light'>Flight duration</p>
                                            </div>
                                        </div>
                                    </div>
                                    <ul className='timeline_list'>
                                        <li>
                                            <h6 className='fw-semibold'>
                                                {formatDate(firstSegment.departing_at)}, {formatTime(firstSegment.departing_at)} 
                                                <small>Depart from {firstSegment.origin?.name} ({firstSegment.origin?.iata_code}), Terminal {firstSegment.origin_terminal}</small>
                                            </h6>
                                            <p className='font_light'>Flight duration: {formatDuration(firstSegment.duration)}</p>
                                        </li>
                                        <li>
                                            <h6 className='fw-semibold'>
                                                {formatDate(firstSegment.arriving_at)}, {formatTime(firstSegment.arriving_at)} 
                                                <small>Arrive at {firstSegment.destination?.name} ({firstSegment.destination?.iata_code}), Terminal {firstSegment.destination_terminal}</small>
                                            </h6>
                                            <ul className='detailtag_list font_light'>
                                                <li>{cabinClass.toUpperCase()}</li>
                                                <li>{firstSegment.marketing_carrier?.name}</li>
                                                <li>{firstSegment.aircraft?.name || 'Unknown aircraft'}</li>
                                                <li>{firstSegment.marketing_carrier_flight_number}</li>
                                                {firstSegment.passengers?.[0]?.baggages?.map((bag, index) => (
                                                    <li key={index}>
                                                        <span>
                                                            <i className={`ti ti-${bag.type === 'carry_on' ? 'briefcase' : 'briefcase-2'} me-2`}></i>
                                                            {bag.quantity} {bag.type} bag{bag.quantity > 1 ? 's' : ''}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </li>
                                    </ul>
                                </div>
                            )}

                            {/* Return Flight (if exists) */}
                            {returnSlice.segments && returnSlice.segments.length > 0 && (
                                <div className='booking_card mt-4'>
                                    <div className='d-md-flex align-items-center justify-content-between'>
                                        <div className='d-flex align-items-start gap-sm-4 gap-2'>
                                            <div className='badge bg-primary p-2'>
                                                <i className='ti ti-plus fs-6'></i>
                                            </div>
                                            <div>
                                                <h5 className='fw-semibold'>
                                                    <span>{formatDate(returnSegment.departing_at)}</span> 
                                                    <span>{formatTime(returnSegment.departing_at)} - {formatTime(returnSegment.arriving_at)}</span>
                                                </h5>
                                                <p className='font_light'>{cabinClass} - {returnSegment.marketing_carrier?.name}</p>
                                            </div>
                                        </div>
                                        <div className='time_detail'>
                                            <div className=''>
                                                <h5 className='fw-semibold'>
                                                    <span>{formatTime(returnSegment.departing_at)} - {formatTime(returnSegment.arriving_at)}</span>
                                                </h5>
                                                <p className='font_light'>{returnSegment.origin?.iata_code} - {returnSegment.destination?.iata_code}</p>
                                            </div>
                                            <div className=''>
                                                <h5 className='fw-semibold'>
                                                    <span>{formatDuration(returnSegment.duration)}</span>
                                                </h5>
                                                <p className='font_light'>Flight duration</p>
                                            </div>
                                        </div>
                                    </div>
                                    <ul className='timeline_list'>
                                        <li>
                                            <h6 className='fw-semibold'>
                                                {formatDate(returnSegment.departing_at)}, {formatTime(returnSegment.departing_at)} 
                                                <small>Depart from {returnSegment.origin?.name} ({returnSegment.origin?.iata_code}), Terminal {returnSegment.origin_terminal}</small>
                                            </h6>
                                            <p className='font_light'>Flight duration: {formatDuration(returnSegment.duration)}</p>
                                        </li>
                                        <li>
                                            <h6 className='fw-semibold'>
                                                {formatDate(returnSegment.arriving_at)}, {formatTime(returnSegment.arriving_at)} 
                                                <small>Arrive at {returnSegment.destination?.name} ({returnSegment.destination?.iata_code}), Terminal {returnSegment.destination_terminal}</small>
                                            </h6>
                                            <ul className='detailtag_list font_light'>
                                                <li>{cabinClass.toUpperCase()}</li>
                                                <li>{returnSegment.marketing_carrier?.name}</li>
                                                <li>{returnSegment.aircraft?.name || 'Unknown aircraft'}</li>
                                                <li>{returnSegment.marketing_carrier_flight_number}</li>
                                                {returnSegment.passengers?.[0]?.baggages?.map((bag, index) => (
                                                    <li key={index}>
                                                        <span>
                                                            <i className={`ti ti-${bag.type === 'carry_on' ? 'briefcase' : 'briefcase-2'} me-2`}></i>
                                                            {bag.quantity} {bag.type} bag{bag.quantity > 1 ? 's' : ''}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="col-lg-8">
                            <div className='row gy-4'>
                                <div className='col-md-6'>
                                    <div className='flightdetail_card border'>
                                        <div className="icon_wrap badge bg-success p-2">
                                            <i className='ti ti-plane fs-6'></i>
                                        </div>
                                        <h6 className='fw-bold'>Order change policy</h6>
                                        <p>
                                            {bookingData?.conditions?.change_before_departure?.allowed
                                            ? `Make changes to this flight up until the departure date (a change penalty of 
                                                ${bookingData.conditions.change_before_departure.penalty_amount} 
                                                ${bookingData.conditions.change_before_departure.penalty_currency} will apply)`
                                            : 'Changes to this flight are not allowed'}
                                        </p>
                                    </div>
                                </div>
                                <div className='col-md-6'>
                                    <div className='flightdetail_card border'>
                                        <div className="icon_wrap badge bg-success p-2">
                                            <i className='ti ti-plane fs-6'></i>
                                        </div>
                                        <h6 className='fw-bold'>Order refund policy</h6>
                                        <p>
                                            {bookingData?.conditions?.refund_before_departure?.allowed ? 
                                              `Refunds available with penalty of 
                                              ${bookingData.conditions.refund_before_departure.penalty_amount || 'N/A'} 
                                              ${bookingData.conditions.refund_before_departure.penalty_currency || ''}` : 
                                              'This order is not refundable'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Details Section */}
            <section className='space-py-50'>
                <div className='container'>
                    <div className='row justify-content-center'>
                        <div className='col-lg-8'>
                            <h4 className="fw-bold mb-3 fw-semibold">Contact details</h4>
                            <div className='contact_group mt-0'>
                                {/* start contact info */}
                                <Form className='row gy-4'>
                                    <div className='col-md-6'>
                                        <Form.Label>Email <sup>*</sup></Form.Label>
                                        <Form.Control 
                                            type="email" 
                                            placeholder="" 
                                            value={formData.contact.email}
                                            onChange={(e) => handleInputChange(null, 'contact.email', e.target.value)}
                                            isInvalid={!!validationErrors.contact_email}
                                        />
                                        {validationErrors.contact_email && (
                                            <Form.Control.Feedback type="invalid">
                                                {validationErrors.contact_email}
                                            </Form.Control.Feedback>
                                        )}
                                    </div>
                                    <div className='col-md-6'>
                                        <Form.Label>Phone number <sup>*</sup></Form.Label>
                                        <Form.Control 
                                            type="tel" 
                                            placeholder="" 
                                            value={formData.contact.phone}
                                            onChange={(e) => handleInputChange(null, 'contact.phone', e.target.value)}
                                            isInvalid={!!validationErrors.contact_phone}
                                        />
                                        {validationErrors.contact_phone && (
                                            <Form.Control.Feedback type="invalid">
                                                {validationErrors.contact_phone}
                                            </Form.Control.Feedback>
                                        )}
                                    </div>
                                </Form>
                                {/* end contact info */}
                            </div>
                            
                            {/* Start Passenger Details */}
                            {formData.passengers.map((passenger, index) => {
                                const passengerErrors = validationErrors[`passenger_${index}`] || {};
                                return (
                                    <div className='contact_group' key={index}>
                                        {/*{bookingData.passengers[index].type} 
                                        adult
                                        child
                                        infant_without_seat*/}
                                        <ul className="tag_list mb-3">
                                            <li>
                                                {bookingData.passengers[index].type === 'adult' ? 'Adult' : 
                                                 bookingData.passengers[index].type === 'child' ? 'Child' : 'Infant'} {index + 1}
                                            </li>
                                        </ul>

                                        {/* ... [keep your existing passenger header] ... */}
                                        <Form className='row gy-4'>
                                            <div className='col-md-2'>
                                                 <input 
                                                    type="hidden" 
                                                    name="id" 
                                                    value={passenger.id} 
                                                />
                                                <input 
                                                    type="hidden" 
                                                    name="phone_number" 
                                                    value={passenger.phone_number} 
                                                />
                                                <input 
                                                    type="hidden" 
                                                    name="email" 
                                                    value={passenger.email} 
                                                />
                                                <Form.Label>Title <sup>*</sup></Form.Label>
                                                <Form.Select 
                                                    value={passenger.title}
                                                    onChange={(e) => handleInputChange(index, 'title', e.target.value)}
                                                >
                                                    <option value="mr">Mr.</option>
                                                    <option value="mrs">Mrs.</option>
                                                    <option value="miss">Miss</option>
                                                </Form.Select>
                                            </div>
                                            <div className='col-md-5'>
                                                <Form.Label>Given name <sup>*</sup></Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    placeholder="" 
                                                    value={passenger.given_name}
                                                    onChange={(e) => handleInputChange(index, 'given_name', e.target.value)}
                                                    isInvalid={!!passengerErrors.given_name}
                                                />
                                                {passengerErrors.given_name && (
                                                    <Form.Control.Feedback type="invalid">
                                                        {passengerErrors.given_name}
                                                    </Form.Control.Feedback>
                                                )}
                                            </div>
                                            <div className='col-md-5'>
                                                <Form.Label>Family name <sup>*</sup></Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    placeholder="" 
                                                    value={passenger.family_name}
                                                    onChange={(e) => handleInputChange(index, 'family_name', e.target.value)}
                                                    isInvalid={!!passengerErrors.family_name}
                                                />
                                                {passengerErrors.family_name && (
                                                    <Form.Control.Feedback type="invalid">
                                                        {passengerErrors.family_name}
                                                    </Form.Control.Feedback>
                                                )}
                                            </div>
                                            <div className='col-md-5'>
                                                <Form.Label>Date of birth <sup>*</sup></Form.Label>
                                                <DatePicker
                                                    selected={passenger.born_on}
                                                    onChange={(date) => handleInputChange(index, 'born_on', date)}
                                                    placeholderText="DD/MM/YYYY"
                                                    dateFormat="dd/MM/yyyy"
                                                    className={`form-control ${passengerErrors.born_on ? 'is-invalid' : ''}`}
                                                    showYearDropdown
                                                    yearDropdownItemNumber={100}
                                                    scrollableYearDropdown
                                                />
                                                {passengerErrors.born_on && (
                                                    <div className="invalid-feedback" style={{ display: 'block' }}>
                                                        {passengerErrors.born_on}
                                                    </div>
                                                )}
                                            </div>
                                            <div className='col-md-5'>
                                                <Form.Label>Gender <sup>*</sup></Form.Label>
                                                <Form.Select 
                                                    value={passenger.gender}
                                                    onChange={(e) => handleInputChange(index, 'gender', e.target.value)}
                                                >
                                                    <option value="m">Male</option>
                                                    <option value="f">Female</option>
                                                </Form.Select>
                                            </div>
                                            {/* ... [update passport fields similarly] ... */}
                                        </Form>
                                        {/*<h6 className='font_light my-4 fw-semibold'>Passport details</h6>
                                        <Form className='row gy-4'>
                                            <div className='col-md-6'>
                                                <Form.Label>Country of issue <sup>*</sup></Form.Label>
                                                <Form.Select aria-label="Default select example">
                                                    <option value="">---</option>
                                                </Form.Select>
                                            </div>
                                            <div className='col-md-6 d-md-flex d-none'></div>
                                            <div className='col-md-6'>
                                                <Form.Label>Passport number</Form.Label>
                                                <Form.Control type="text" placeholder="" />
                                            </div>
                                            <div className='col-md-5'>
                                                <Form.Label>Expiry Date</Form.Label>
                                                <DatePicker
                                                    selected={null}
                                                    onChange={(date) => {
                                                        const dateStateSetters = [setStartDate2, setStartDate4, setStartDate6, setStartDate8];
                                                        dateStateSetters[index]?.(date);
                                                    }}
                                                    placeholderText="DD / MM / YYYY"
                                                    dateFormat="DD / MM / YYYY"
                                                    className="form-control"
                                                />
                                            </div>
                                        </Form>*/}
                                    </div>
                                );
                            })}
                            {/* End Passenger Details */}
                        </div>
                    </div>
                </div>
            </section>

            {/* Start Add Extra */}
            <section className='space-pb-50'>
                <div className='container'>
                    <div className='row justify-content-center'>
                        <div className='col-lg-8'>
                            <div className="selected_card">
                                <h4 className="fw-bold mb-3">Add extras</h4>
                                <ul className='lageg_list'>
                                    <li>
                                        <span className='icon_wrap'>
                                            <i className='ti ti-luggage'></i>
                                        </span>
                                        <div className='d-flex align-items-center justify-content-between'>
                                            <h6 className='fw-semibold'>Extra baggage</h6>
                                            <span className='status_label'>Not available</span>
                                        </div>
                                        <p>Add any extra baggage you need for your trip</p>
                                    </li>
                                    <li>
                                        <span className='icon_wrap'>
                                            <i className='ti ti-armchair'></i>
                                        </span>
                                        <div className='d-flex align-items-center justify-content-between'>
                                            <h6 className='fw-semibold'>Seat selection</h6>
                                            <i className='ti ti-selector'></i>
                                        </div>
                                        <p>Specify where on the plane you'd like to sit</p>
                                    </li>
                                    <li>
                                        <span className='icon_wrap'>
                                            <i className='ti ti-alert-hexagon'></i>
                                        </span>
                                        <div className='d-flex align-items-center justify-content-between'>
                                            <h6 className='fw-semibold'>Travel insurance</h6>
                                            <span className='status_label'>Not available</span>
                                        </div>
                                        <p>Add travel insurance for your trip</p>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Start add Meta data */}
            {/*<section className='space-pb-50'>
                <div className='container'>
                    <div className='row justify-content-center'>
                        <div className='col-lg-8'>
                            <div className="selected_card">
                                <h4 className="fw-bold mb-3">Add metadata</h4>
                                <Form className='row gy-4'>
                                    <div className='col-md-6'>
                                        <Form.Label>Key <small className='font_light'>optional</small></Form.Label>
                                        <Form.Control type="text" placeholder="" />
                                    </div>
                                    <div className='col-md-6'>
                                        <Form.Label>Value <small className='font_light'>optional</small></Form.Label>
                                        <Form.Control type="text" placeholder="" />
                                    </div>
                                </Form>
                                <p className='text-end'>Add anothe key/value pair</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>*/}

            {/* Payment Section */}
            <section className='space-pb-50'>
                <div className='container'>
                    <div className='row justify-content-center'>
                        <div className='col-lg-8'>
                            <div className="selected_card">
                                <h4 className="fw-bold mb-3">Payment</h4>
                                <table className='total_table table table-striped fs-6'>
                                    <thead>
                                        <tr>
                                            <th>Description</th>
                                            <th className='text-end'>Price ({bookingData.total_currency})</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Fare</td>
                                            <td align='right'>{bookingData.base_amount}</td>
                                        </tr>
                                        <tr>
                                            <td>Fare taxes</td>
                                            <td align='right'>{bookingData.tax_amount}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td></td>
                                            <td align='right'> 
                                                <strong className='me-3'>Total({bookingData.total_currency})</strong> 
                                                <strong>{bookingData.total_amount}</strong>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                                {/*<Button 
                                    className='btn btn-primary mt-4'
                                    onClick={handlePayNow}
                                    disabled={paying}
                                >
                                    {paying ? 'Processing...' : 'Pay Now'}
                                </Button>*/}
                                 {!isOfferExpired ? (
                                    <Button 
                                        className='btn btn-primary mt-4'
                                        onClick={handlePayNow}
                                        disabled={paying}
                                    >
                                        {paying ? 'Processing...' : 'Pay Now'}
                                    </Button>

                                ) : (
                                    <div className="alert alert-danger mt-4">
                                        This offer has expired. Please start a new search.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
        </>
    );
};

export default BookingCart;