import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Spinner, Alert, Button } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { IconChevronLeft } from '@tabler/icons-react';
import { getToken, checkAndLogoutIfExpired } from '../utils/auth';

export default function StaysBookingDetails() {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const bookingRef = searchParams.get('booking_ref');

  useEffect(() => {
    if (bookingRef) {
      fetchBookingDetails();
    } else {
      setError('Booking reference is missing');
      setLoading(false);
    }
    // eslint-disable-next-line
  }, [bookingRef]);

  const fetchBookingDetails = async () => {
    if (checkAndLogoutIfExpired()) return;
    const token = getToken();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/booking/get-user-Stays-single-booking`,
        { booking_ref: bookingRef },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      //console.log('Booking Details Response:', response.data);
      
      if (response.data && response.data.booking) {
        setBooking(response.data.booking);
      } else {
        setError('No booking data found');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch booking details';
      setError(errorMessage);
      console.error('Error fetching booking details:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseJSONData = (jsonString) => {
    try {
      return jsonString ? JSON.parse(jsonString) : null;
    } catch (e) {
      console.error('Error parsing JSON:', e);
      return null;
    }
  };

  const getAccommodationInfo = () => {
    if (!booking) return null;
    
    const conformOrder = parseJSONData(booking.conform_order_json);
    const staysQuotes = parseJSONData(booking.stays_quotes);
    
    return conformOrder?.data?.accommodation || staysQuotes?.data?.accommodation || null;
  };

  const getBookingInfo = () => {
    if (!booking) return null;
    
    const conformOrder = parseJSONData(booking.conform_order_json);
    const staysQuotes = parseJSONData(booking.stays_quotes);
    if (conformOrder?.data?.message) {
      return staysQuotes?.data || null;
    }
    return conformOrder?.data || staysQuotes?.data || null;
  };

  const getGuestInfo = () => {
    if (!booking) return null;
    
    // Try to get from guest_details first
    const guestDetails = parseJSONData(booking.guest_details);
    if (guestDetails) return guestDetails;
    
    // Fall back to booking_json
    const bookingJson = parseJSONData(booking.booking_json);
    if (bookingJson && bookingJson.data) {
      return {
        guests: bookingJson.data.guests,
        email: bookingJson.data.email,
        phone_number: bookingJson.data.phone_number
      };
    }
    
    return null;
  };

  const getPaymentInfo = () => {
    if (!booking) return null;
    
    const paymentData = parseJSONData(booking.pay_json);
    return paymentData || null;
  };

  const getConformOrderMessage = () => {
    if (!booking) return null;
    const conformOrder = parseJSONData(booking.conform_order_json);
    return conformOrder?.data?.message || null;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const options = { day: '2-digit', month: 'short', year: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      return 'Invalid date';
    }
  };

  const formatCurrency = (amount, currency) => {
    if (!amount || !currency) return 'N/A';
    
    return `${currency} ${amount}`;
  };

  const getGuestSummary = () => {
    if (!booking) return 'N/A';

    const staysQuotes = parseJSONData(booking.stays_quotes);
    const guestTypes = staysQuotes?.data?.guests || [];

    if (guestTypes.length === 0) {
      return "N/A";
    }

    const adults = guestTypes.filter(g => g.type === "adult").length;
    const children = guestTypes.filter(g => g.type === "child").length;

    return `${guestTypes.length} guests · ${adults} adults · ${children} children`;
  };

  const getNightsCount = () => {
    const bookingInfo = getBookingInfo();
    if (!bookingInfo || !bookingInfo.check_in_date || !bookingInfo.check_out_date) return 'N/A';
    
    try {
      const checkIn = new Date(bookingInfo.check_in_date);
      const checkOut = new Date(bookingInfo.check_out_date);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      return `${nights} nights`;
    } catch (e) {
      return 'N/A';
    }
  };

  const getBookingStatus = () => {
    if (!booking) return 'unknown';
    
    // Check if there's a pending confirmation message

    const conformOrderMessage = getConformOrderMessage();
    
    if (conformOrderMessage) {
      //console.log('final data'+conformOrderMessage);
      return 'pending_confirmation';
    }
    // First try to get status from conform_order_json
    const conformOrder = parseJSONData(booking.conform_order_json);
    if (conformOrder?.data?.status) {
      return conformOrder.data.status;
    }
    
    // Then check payment status
    if (booking.payment_status === 'succeeded' || booking.payment_status === 'paid') {
      return 'confirmed';
    }
    
    if (booking.payment_status === 'pending') {
      return 'pending';
    }
    
    return 'unknown';
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'cancelled': return 'Cancelled';
      case 'pending': return 'Pending Payment';
      case 'pending_confirmation': return 'Pending Confirmation';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <section className="space-py-100">
        <Container>
          <div className="text-center py-5">
            <Spinner animation="border" role="status" variant="primary">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="mt-3">Loading booking details...</p>
          </div>
        </Container>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-py-100">
        <Container>
          <div className="alert alert-danger" role="alert">
            <strong>Error:</strong> {error}
            <div className="mt-2">
              <button 
                className="btn btn-outline-danger btn-sm"
                onClick={fetchBookingDetails}
              >
                Try Again
              </button>
            </div>
          </div>
        </Container>
      </section>
    );
  }

  if (!booking) {
    return (
      <section className="space-py-100">
        <Container>
          <div className="alert alert-warning" role="alert">
            No booking information available.
          </div>
        </Container>
      </section>
    );
  }

  const accommodation = getAccommodationInfo();
  const bookingInfo = getBookingInfo();
  const guestInfo = getGuestInfo();
  const paymentInfo = getPaymentInfo();
  const conformOrderMessage = getConformOrderMessage();
  const status = getBookingStatus();
  
  return (
    <>
      <section className="space-py-100 px-4">
        <Container>
          <Link className="mb-3 d-inline-block fs-6 btn btn-link" to="/staysorderhistory"><IconChevronLeft size={22} />Back to Bookings</Link>
          
          <div className="d-flex mb-4">
            <div>
              <p>Accommodation reference</p>
              <h4>{booking.booking_reference}</h4>
            </div>
          </div>
           {/* Pending Confirmation Banner */}

          {conformOrderMessage && (
            <Alert variant="warning" className="mb-4">
              <strong>Pending Confirmation:</strong> {conformOrderMessage}
            </Alert>

          )}
          <div className="booking-card">
            <div className="booking-row">
              <div className="booking-col">
                <p className="label">Source</p>
                <Link href="#" className="link">Duffel</Link>
              </div>
              <div className="booking-col">
                <p className="label">Issuing date</p>
                <p className="value">{formatDate(booking.created_at)}</p>
              </div>
            </div>

            <div className="booking-row">
              <div className="booking-col">
                <p className="label">Status</p>
                <span className={`status ${status}`}>
                  {getStatusText(status)}
                </span>
              </div>
            </div>

            <div className="booking-row">
              <div className="booking-col">
                <p className="label">Guest email</p>
                <a href={`mailto:${guestInfo?.email || ''}`} className="value">
                  {guestInfo?.email || 'N/A'}
                </a>
              </div>
              <div className="booking-col">
                <p className="label">Guest phone number</p>
                <a href={`tel:${guestInfo?.phone_number || ''}`} className="value">
                  {guestInfo?.phone_number || 'N/A'}
                </a>
              </div>
            </div>

            <div className="booking-row">
              <div className="booking-col">
                <p className="label">Booking</p>
                <p className="value">
                  {bookingInfo?.rooms ? `${bookingInfo.rooms} room` : '1 room'} · {getNightsCount()}
                </p>
              </div>
              <div className="booking-col">
                <p className="label">Guests</p>
                <p className="value">{getGuestSummary()}</p>
                {guestInfo?.guests?.map((guest, index) => (
                  <p key={index} className="guest-name">
                    {guest.given_name} {guest.family_name}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <h2 className="section-title">Booking details</h2>
          <div className="booking-card">
            {accommodation && (
              <div className="hotel-info">
                {accommodation.photos && accommodation.photos.length > 0 && (
                  <img 
                    src={accommodation.photos[0].url} 
                    alt={accommodation.name} 
                    className="hotel-img" 
                  />
                )}
                <div className="hotel-details">
                  <h3 className="hotel-name">
                    {accommodation.name} {accommodation.rating && (
                      <span className="stars">{'★'.repeat(Math.floor(accommodation.rating))}</span>
                    )}
                  </h3>
                  {accommodation.location && accommodation.location.address && (
                    <p className="hotel-address">
                      {accommodation.location.address.line_one}, {accommodation.location.address.city_name}, {accommodation.location.address.postal_code}, {accommodation.location.address.country_code}
                    </p>
                  )}
                </div>
              </div>
            )}


            {accommodation?.rooms?.map((room, index) => (
              <div key={index}>
                <p className="room-type">
                  <span>{bookingInfo?.rooms ? `${bookingInfo.rooms}` : '1'}x</span> {room.name || 'Room'}
                </p>
                {room.rates?.[0]?.board_type && (
                  <p className="meal-info">
                    {room.rates[0].board_type.replace(/_/g, ' ')}
                  </p>
                )}
              </div>
            ))}

            {bookingInfo && (
              <div className="check-section mt-3">
                <div className="check-in">
                  <span className="label">Check in</span>
                  <p className="date">{formatDate(bookingInfo.check_in_date)}</p>
                  {accommodation?.check_in_information && (
                    <span className="time">from {accommodation.check_in_information.check_in_after_time}</span>
                  )}
                </div>
                <div className="divider"></div>
                <div className="check-out">
                  <span className="label">Check out</span>
                  <p className="date">{formatDate(bookingInfo.check_out_date)}</p>
                  {accommodation?.check_in_information && (
                    <span className="time">until {accommodation.check_in_information.check_out_before_time}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <h2 className="section-title">Contact details</h2>
          <div className="booking-card">
            <p><strong>Phone:</strong></p>
            <p>{accommodation?.phone_number || 'N/A'}</p>
            {accommodation?.email && (
              <>
                <p><strong>Email:</strong></p>
                <p>{accommodation.email}</p>
              </>
            )}
          </div>

          <h2 className="section-title">Billing summary</h2>
          <div className="booking-card">
            <div className="billing-section">
              <p className="title">Paid on {formatDate(booking.created_at)}</p>
              <table className="billing-table">
                <tbody>
                  {bookingInfo?.accommodation?.rooms?.[0]?.rates?.[0] && (
                    <>
                      <tr>
                        <td>Room(s)</td>
                        <td className="amount">{formatCurrency(bookingInfo.accommodation.rooms[0].rates[0].base_amount, bookingInfo.accommodation.rooms[0].rates[0].base_currency)}</td>
                      </tr>
                      <tr>
                        <td>Tax</td>
                        <td className="amount">{formatCurrency(bookingInfo.accommodation.rooms[0].rates[0].tax_amount, bookingInfo.accommodation.rooms[0].rates[0].tax_currency)}</td>
                      </tr>
                      <tr>
                        <td>Fees</td>
                        <td className="amount">{formatCurrency(bookingInfo.accommodation.rooms[0].rates[0].fee_amount, bookingInfo.accommodation.rooms[0].rates[0].fee_currency)}</td>
                      </tr>
                      <tr className="total-row">
                        <td>Total</td>
                        <td className="amount">{formatCurrency(bookingInfo.accommodation.rooms[0].rates[0].total_amount, bookingInfo.accommodation.rooms[0].rates[0].total_currency)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              <p className="payment-method">Payment method: {paymentInfo?.payment_method_types?.[0] || 'balance'}</p>
            </div>

            {bookingInfo?.accommodation?.rooms[0]?.rates[0]?.due_at_accommodation_amount && parseFloat(bookingInfo?.accommodation?.rooms[0]?.rates[0]?.due_at_accommodation_amount) > 0 && (
              <div className="billing-section">
                <p className="title">Pay at accommodation</p>
                <table className="billing-table">
                  <tbody>
                    <tr>
                      <td>Accommodation fee</td>
                      <td className="amount">
                        {formatCurrency(bookingInfo.accommodation.rooms[0].rates[0].due_at_accommodation_amount, bookingInfo.accommodation.rooms[0].rates[0].due_at_accommodation_currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          <h4 className="section-title">Cancellation Policy</h4>
          <div className="booking-card">
            {accommodation?.rooms?.[0]?.rates?.[0]?.cancellation_timeline && accommodation.rooms[0].rates[0].cancellation_timeline.length > 0 ? (
              <>
                <ul className="policy_list">
                  {accommodation.rooms[0].rates[0].cancellation_timeline.map((policy, index) => (
                    <li key={index} className="list_item">
                      <div className="check_icon">
                        <i className='ti ti-check check_i'></i>
                      </div>
                      <p>
                        <strong>{policy.refund_amount && parseFloat(policy.refund_amount) > 0 ? 'Refundable for a fee' : 'No refund'}</strong>
                        {policy.before && ` -- If you cancel before ${formatDate(policy.before)}, you will receive a refund of ${formatCurrency(policy.refund_amount, policy.currency)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No cancellation policy information available.</p>
            )}
          </div>

          <h4 className="section-title">Terms and conditions</h4>
          <div className="booking-card">
            {/*<p>
              By paying, you confirm you agree to Duffel's Booking Terms and Conditions (available on the Duffel website)
              and the accommodation's conditions. To find out how Duffel uses your personal data, please see
              Duffel's Privacy Policy.
            </p>*/}
            {accommodation?.rooms?.[0]?.rates?.[0]?.conditions && (
              <div className="mt-3">
                {/*<h5>Additional Conditions:</h5>*/}
                {accommodation.rooms[0].rates[0].conditions.map((condition, index) => (
                  <div key={index} className="condition-item">
                    <strong>{condition.title}:</strong> {condition.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}