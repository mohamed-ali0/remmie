import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Accordion, Form, Table } from 'react-bootstrap';
import { IconHistory, IconTicket, IconPlaneTilt, IconClock, IconChevronUp } from '@tabler/icons-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import travel_img from '/src/assets/images/travel_img.png';

export default function BookingSuccess() {
  // Accordion Start 
  const [activeKey, setActiveKey] = useState(null);
  const handleToggle = (key) => {
    setActiveKey(prevKey => (prevKey === key ? null : key));
  };

  const { search } = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(search);
  const bookingRef = params.get('booking_ref');
  const sessionId = params.get('session_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [orderData, setOrderData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    if (!bookingRef || !sessionId) {
      setError('Missing booking_ref or session_id');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Step 1: Confirm payment
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/stripe/confirm-payment`,
          { booking_ref: bookingRef, session_id: sessionId },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (data.success) {
          setStatus('Payment confirmed! Thank you for your purchase.');

          // Step 2: Save card if needed
          if (sessionId.startsWith('cs_')) {
            await axios.post(
              `${import.meta.env.VITE_API_BASE_URL}/api/stripe/save-card-after-success`,
              { session_id: sessionId },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          }

          // Step 3: Create confirmed order

          const oldData = JSON.parse(data.booking_json).data;
          const guestDetails = JSON.parse(data.guest_details);

          // Track adults who already have an infant
          const assignedAdults = new Set();

          oldData.passengers = oldData.passengers.map((oldPassenger, index) => {
              const newPassenger = guestDetails.passengers.find(p => p.id === oldPassenger.id);
              if (newPassenger) {
                  const updatedPassenger = {
                      id: newPassenger.id,
                      title: newPassenger.title,
                      given_name: newPassenger.given_name,
                      family_name: newPassenger.family_name,
                      born_on: newPassenger.born_on,
                      phone_number: newPassenger.phone_number,
                      email: newPassenger.email,
                      gender: newPassenger.gender
                  };

                  if (newPassenger.type === "adult" && newPassenger.infant_passenger_id && newPassenger.infant_passenger_id.trim() !== "") {
                      updatedPassenger.infant_passenger_id = newPassenger.infant_passenger_id;
                  }

                  return updatedPassenger;
              }
              return oldPassenger;
          });
          
          const confirmOrderPayload = {
            id: data.id,
            data: oldData,
          };

          const orderResponse = await axios.post(
            `${import.meta.env.VITE_API_URL}/flight/create-conform-order`,
            confirmOrderPayload,
            { headers: { 'Content-Type': 'application/json' } }
          );

          // Handle both one-way and round-trip responses
          const responseData = orderResponse.data.data;
          
          // For round-trip bookings, combine slices from both bookings
          if (responseData.is_round_trip && responseData.return_booking) {
            const combinedData = {
              ...responseData,
              slices: [
                ...(responseData.slices || []),
                ...(responseData.return_booking.slices || [])
              ],
              passengers: responseData.passengers || responseData.return_booking.passengers || []
            };
            setOrderData(combinedData);
          } else {
            setOrderData(responseData);
          }
          
          setStatus('Flight booking confirmed!');
        } else {
          setStatus('Payment could not be confirmed. Please contact support.');
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Error confirming payment');
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingRef, sessionId, navigate]);

  if (loading) return <p>Finalizing your payment…</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  // Helper function to format date
  const formatDate = (dateString) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  // Helper function to format time
  const formatTime = (dateString) => {
    const options = { hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleTimeString('en-US', options);
  };

  // Helper function to parse duration
  const parseDuration = (duration) => {
    const match = duration.match(/PT(\d+)H(\d+)M/);
    if (match) {
      return `${match[1]}h ${match[2]}m`;
    }
    return duration;
  };

  return (
    <section className='space-pt-100 space-pb-100 booking-sec'>
      <Container className="text-center mb-5">
        <h1 className="mb-4">Booking Complete</h1>
        <p><strong>Booking Reference:</strong> {orderData?.booking_reference || bookingRef}</p>
        <p>{status}</p>
        <button onClick={() => navigate(`/booking-details?booking_ref=${bookingRef}`)}>View Booking</button>
      </Container>
      <Container>
        <div className="booling-grid mb-5">
          <div className="booking-padding">
            <div className="icon_history">
              <IconHistory />
            </div>
            <div className="booking-contact">
              <h4 className="text-start mb-2">Your flight is pending</h4>
              <p>Flight availability can change quickly due to fluctuating consolidator fares. We work hard to confirm bookings fast, but sometimes the flight you chose may become unavailable. If we can't secure your ticket within 72 hours, we'll notify you by email and issue a full refund.</p>
            </div>
          </div>
        </div>
        
        {orderData && (
          <>
            <div className="booking-basis mb-5">
              <div className="basis-ticket-contact">
                <h4>Thanks {orderData?.passengers?.[0]?.given_name} {orderData?.passengers?.[0]?.family_name} for choosing Basis!</h4>
                {/*<div className="basis-ticket">
                  <strong className="basis-id"><IconTicket /> Basis Ticket Id:</strong>
                  <Link className='basis-code'>BS{Math.floor(1000 + Math.random() * 9000)}</Link>
                </div>*/}
              </div>
              <p className="basis-test">A confirmation email will be sent to <strong>{orderData?.passengers?.[0]?.email}</strong>. This may take up to 30 minutes.</p>
            </div>

            <div className="booling-grid mb-5">
              <div className="booking-flights">
                <div className="icon_flights">
                  <IconPlaneTilt className="text_primary" />
                </div>
                <div className="flights-contact">
                  <h4 className="text-start text_primary mb-2">Free 24 Hour Cancellation</h4>
                  <p>For a full refund, you can contact our support team within 24 hours of booking.</p>
                </div>
              </div>
            </div>

            {/* Flight Details */}
            <div className="flight-details mb-5 space-pt-50 space-pb-50">
              {orderData?.slices?.map((slice, index) => (
                <div className="flight-booking mb-5" key={index}>
                  <div className="flight-title text-center py-3">
                    <p><strong>{index === 0 ? 'Departure' : 'Return'}</strong></p>
                    <p className="d-flex gap-2 justify-content-center">
                      <span>{slice.segments.length === 1 ? 'Non-Stop' : `${slice.segments.length - 1}-Stop`}</span>
                      <span><IconClock className="text_primary" /></span>
                      <span>{parseDuration(slice.duration)}</span>
                    </p>
                  </div>
                  <div className="flight-list p-4">
                    <div className="list-details">
                      <div className="list-contact-title">
                        <h4 className="text_primary">{formatDate(slice?.segments?.[0]?.departing_at)}</h4>
                        <p>
                          <span>Record Locator:</span>
                          <span>{orderData?.booking_reference}</span>
                        </p>
                      </div>

                      {slice?.segments?.map((segment, segIndex) => (
                        <div key={segIndex}>
                          <div className="list-details-contact">
                            <div className="list-contact">
                              <div className="flight-details-contact">
                                <div className="d-flex gap-3 mb-2">
                                  <div className="flight-logo">
                                    <div className='img_wrap'>
                                      <img src={segment.operating_carrier.logo_symbol_url || travel_img} alt="" className='img-fluid' />
                                    </div>
                                  </div>
                                  <div className="flight-list">
                                    <p className="list-text"><strong>{segment.operating_carrier.iata_code} {segment.operating_carrier_flight_number}</strong></p>
                                    <p className="list-text">{segment.aircraft.name}, {Math.round(segment.distance)} miles</p>
                                  </div>
                                </div>
                                <div className="d-flex gap-3">
                                  <p className="list-text">Class</p>
                                  <p className="list-text"><strong>{segment.passengers[0].cabin_class_marketing_name}</strong></p>
                                </div>
                              </div>
                            </div>
                            <div className="list-contact">
                              <p className="list-text"><strong>{formatTime(segment.departing_at)}</strong></p>
                              <p className="list-text">{segment.origin.name} ({segment.origin.iata_code})</p>
                              <p className="list-text small">Terminal: {segment.origin_terminal}</p>
                            </div>
                            <div className="list-contact text-center">
                              <div className="flight-duration">
                                <p className="list-text flight-line"><strong>{parseDuration(segment.duration)}</strong></p>
                                <p className="list-text">Flight Duration</p>
                              </div>
                            </div>
                            <div className="list-contact text-end">
                              <p className="list-text"><strong>{formatTime(segment.arriving_at)}</strong></p>
                              <p className="list-text">{segment.destination.name} ({segment.destination.iata_code})</p>
                              <p className="list-text small">Terminal: {segment.destination_terminal}</p>
                            </div>
                          </div>

                          {segIndex < slice.segments.length - 1 && (
                            <div className="layover-line">
                              <p className="layover-text text_primary">
                                Layover: {segment.destination.name} ({segment.destination.iata_code}) {parseDuration(slice.segments[segIndex + 1].departing_at - segment.arriving_at)}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Flight & Traveler Information */}
            <div className="flight-info mb-5">
              <h2 className="info-title">Flight & Traveler Information</h2>
              <p className="info-text">If you have updated your seat selection since booking, the update may not appear here. Please contact the airline to confirm your seat selection.</p>

              <div className="flight-accordion mt-5">
                <Accordion defaultActiveKey="0" flush>
                  {orderData?.passengers?.map((passenger, index) => (
                    <Accordion.Item
                      eventKey={index.toString()}
                      key={passenger.id}
                      className={activeKey === index.toString() ? 'accordion-item active' : 'accordion-item'}
                    >
                      <Accordion.Header>
                        <div className="d-flex gap-2 align-items-center">
                          <strong className="title">Traveler #{index + 1}</strong>
                          <span className="title-text">{passenger.given_name} {passenger.family_name}</span>
                        </div>
                        <span className="icon_wrap"><IconChevronUp /></span>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="flight-from">
                          <div className="flight-list-from">
                            <div className="list-data">
                              <p className="list-title"><strong>GENDER</strong></p>
                              <p className="list-text"><span>{passenger.gender === 'm' ? 'Male' : 'Female'}</span></p>
                            </div>
                            <div className="list-data">
                              <p className="list-title"><strong>DATE OF BIRTH</strong></p>
                              <p className="list-text"><span>{formatDate(passenger.born_on)}</span></p>
                            </div>
                            <div className="list-data">
                              <p className="list-title"><strong>PHONE NUMBER</strong></p>
                              <p className="list-text"><span>{passenger.phone_number}</span></p>
                            </div>
                            <div className="list-data">
                              <p className="list-title"><strong>EMAIL</strong></p>
                              <p className="list-text"><span>{passenger.email}</span></p>
                            </div>
                          </div>
                          <div className="flight-list-from">
                            <div className="list-data">
                              <p className="list-title"><strong>LOYALTY PROGRAM:</strong></p>
                              <p className="list-text"><span>
                                {passenger.loyalty_programme_accounts?.length > 0 ?
                                  passenger.loyalty_programme_accounts[0].account_number :
                                  'None'}
                              </span></p>
                            </div>
                            <div className="list-data">
                              <p className="list-title"><strong>BAGGAGE:</strong></p>
                              <p className="list-text"><span>
                                {orderData?.slices?.[0]?.segments?.[0]?.passengers?.[index]?.baggages?.map(bag => (
                                  `${bag.quantity} ${bag.type.replace('_', ' ')}`
                                )).join(', ')}
                              </span></p>
                            </div>
                          </div>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </div>
            </div>

            {/* Cost & Billing Information */}
            <div className="billing-info mb-5">
              <h2 className="info-title">Cost and Billing Information</h2>
              <div className="cost-billing">
                <div className="billing-title text-center py-3">
                  <p><strong>Cost Information</strong></p>
                </div>
                <div className="billing-list p-4">
                  <Table className="">
                    <tbody>
                      <tr>
                        <td>
                          <p className="text_primary"><strong>FARE</strong></p>
                          <p>Passenger x {orderData?.passengers?.length || 1}</p>
                        </td>
                        <td align="end">
                          <p><strong>${orderData?.base_amount || 0}</strong></p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p className="text_primary"><strong>TAXES AND FEES</strong></p>
                          <p>Passenger x {orderData?.passengers?.length || 1}</p>
                        </td>
                        <td align="end">
                          <p><strong>${orderData?.tax_amount || 0}</strong></p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p className="text_primary"><strong className="text_primary">Total</strong></p>
                        </td>
                        <td align="end">
                          <p className="text_primary"><strong className="text_primary">${orderData?.total_amount || 0}</strong></p>
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Policies, Rules and Restrictions */}
            <div className="policies-info">
              <h2 className="info-title">Policies, Rules and Restrictions</h2>
              <div className="policies-details p-4">
                <p className="policies-text">
                  The U.S. government raised the security alert level and implemented extra restrictions to assure
                  the security of air travel. Certain changes in airport procedures and restrictions on items
                  allowed on board aircraft are detailed on the <Link to="" className="text_primary">Travel Alert: Elevated Security</Link> page.
                </p>
                {orderData?.conditions?.refund_before_departure?.allowed && (
                  <p className="policies-text mt-3">
                    <strong>Refund Policy:</strong> Refunds are allowed before departure with a penalty of {orderData?.conditions?.refund_before_departure?.penalty_amount || 0} {orderData?.conditions?.refund_before_departure?.penalty_currency || 'USD'}.
                  </p>
                )}
                <p className="policies-text mt-3">
                  <strong>Changes Policy:</strong> Changes are {orderData?.conditions?.change_before_departure?.allowed ? 'allowed' : 'not allowed'} before departure.
                </p>
              </div>
            </div>
          </>
        )}
      </Container>
    </section>
  );
}