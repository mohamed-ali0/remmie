import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Spinner, Alert, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getToken, checkAndLogoutIfExpired } from '../utils/auth';
import Userprofilesidebar from '../components/Userprofilesidebar';

export default function StaysOrderHistory() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStaysBookings();
    // eslint-disable-next-line
  }, []);

  const fetchStaysBookings = async () => {
    if (checkAndLogoutIfExpired(navigate)) return;
    const token = getToken();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/booking/get-user-stays-booking-list`,
        {},
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      // Check the actual response structure
      console.log('API Response:', response.data);
      
      // Extract bookings based on the actual API response structure
      if (response.data && response.data.bookings && Array.isArray(response.data.bookings)) {
        setBookings(response.data.bookings);
      } else if (Array.isArray(response.data)) {
        // Fallback if the response is directly an array
        setBookings(response.data);
      } else {
        console.warn('Unexpected API response structure:', response.data);
        setBookings([]);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch bookings';
      setError(errorMessage);
      console.error('Error fetching stays bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (bookingRef) => {
    navigate(`/staysbookingdetails?booking_ref=${bookingRef}`);
  };

  const parseJSONData = (jsonString) => {
    try {
      return jsonString ? JSON.parse(jsonString) : null;
    } catch (e) {
      console.error('Error parsing JSON:', e);
      return null;
    }
  };

  const getStatusBadgeClass = (booking) => {
    // Check if booking is pending confirmation
    const conformOrder = parseJSONData(booking.conform_order_json);
    if (conformOrder?.data?.message) {
      return 'status-badge pending-confirmation';
    }
    if (booking.payment_status === 'cancelled') {
      return 'status-badge cancelled';
    }

    if (booking.payment_status === 'succeeded' || booking.payment_status === 'paid') {
      const bookingStatus = getBookingStatus(booking);
      return bookingStatus === 'confirmed' ? 'status-badge confirmed' : 'status-badge past';
    }
    return 'status-badge pending';
  };
  // const getStatusBadgeClass = (status, paymentStatus) => {
  //   if (status === 'cancelled') {
  //     return 'status-badge cancelled';
  //   }
    
  //   if (paymentStatus === 'succeeded' || paymentStatus === 'paid') {
  //     return status === 'confirmed' ? 'status-badge confirmed' : 'status-badge past';
  //   }
    
  //   return 'status-badge pending';
  // };
  const getStatusText = (booking) => {
    // Check if booking is pending confirmation
    const conformOrder = parseJSONData(booking.conform_order_json);
    if (conformOrder?.data?.message) {
      return 'Pending Confirmation';
    }

    if (booking.payment_status === 'cancelled') {
      return 'Cancelled';
    }

    if (booking.payment_status !== 'succeeded' && booking.payment_status !== 'paid') {
      return 'Pending Payment';
    }

    const bookingStatus = getBookingStatus(booking);
    if (bookingStatus === 'confirmed') {
      return 'Confirmed';
    }
    return 'Past';
  };

  // const getStatusText = (status, paymentStatus) => {
  //   if (status === 'cancelled') return 'Cancelled';
  //   if (paymentStatus !== 'succeeded' && paymentStatus !== 'paid') return 'Pending Payment';
  //   if (status === 'confirmed') return 'Confirmed';
  //   return 'Past';
  // };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      return 'Invalid date';
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const now = new Date();
      const created = new Date(dateString);
      const diffInMs = now - created;
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return '1 day ago';
      if (diffInDays < 7) return `${diffInDays} days ago`;
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) > 1 ? 's' : ''} ago`;
      
      return `${Math.floor(diffInDays / 30)} month${Math.floor(diffInDays / 30) > 1 ? 's' : ''} ago`;
    } catch (e) {
      return 'N/A';
    }
  };

  const getGuestNames = (guestDetails) => {
    try {
      if (!guestDetails) return 'N/A';
      
      // const guests = JSON.parse(guestDetails).guests;
      const guests = parseJSONData(guestDetails)?.guests;
      if (!guests || !Array.isArray(guests)) return 'N/A';
      
      return guests.map(guest => 
        `${guest.given_name || ''} ${guest.family_name || ''}`
      ).filter(name => name.trim()).join(', ') || 'N/A';
    } catch (e) {
      return 'N/A';
    }
  };

  const getStayInfo = (booking) => {
    try {
      const conformOrder = parseJSONData(booking.conform_order_json);
      const staysQuotes = parseJSONData(booking.stays_quotes);
      // Check if conform_order_json contains a message instead of booking data
      if (conformOrder?.data?.message) {
        return staysQuotes?.data?.accommodation || { name: 'Unknown Stay', location: null };
      }
      // Try to get from conform_order_json first
      if (conformOrder?.data?.accommodation) {
        return {
          name: conformOrder.data.accommodation.name,
          location: conformOrder.data.accommodation.location
        };
      }
      // Fall back to stays_quotes
      if (staysQuotes?.data?.accommodation) {
        return {
          name: staysQuotes.data.accommodation.name,
          location: staysQuotes.data.accommodation.location
        };
      }
      return { name: 'Unknown Stay', location: null };
    } catch (e) {
      console.error('Error parsing stay info:', e);
      return { name: 'Unknown Stay', location: null };
    }
  };
  // const getStayInfo = (booking) => {
  //   try {
  //     // Try to get from conform_order_json first
  //     if (booking.conform_order_json) {
  //       const conformOrder = JSON.parse(booking.conform_order_json);
  //       if (conformOrder.data && conformOrder.data.accommodation) {
  //         return {
  //           name: conformOrder.data.accommodation.name,
  //           location: conformOrder.data.accommodation.location
  //         };
  //       }
  //     }
      
  //     // Fall back to stays_quotes
  //     if (booking.stays_quotes) {
  //       const staysQuotes = JSON.parse(booking.stays_quotes);
  //       if (staysQuotes.data && staysQuotes.data.accommodation) {
  //         return {
  //           name: staysQuotes.data.accommodation.name,
  //           location: staysQuotes.data.accommodation.location
  //         };
  //       }
  //     }
      
  //     return { name: 'Unknown Stay', location: null };
  //   } catch (e) {
  //     console.error('Error parsing stay info:', e);
  //     return { name: 'Unknown Stay', location: null };
  //   }
  // };

  const getCheckInDate = (booking) => {
    try {
      const conformOrder = parseJSONData(booking.conform_order_json);
      const staysQuotes = parseJSONData(booking.stays_quotes);
      // Check if conform_order_json contains a message instead of booking data
      if (conformOrder?.data?.message) {
        return staysQuotes?.data?.check_in_date || null;
      }
      // Try to get from conform_order_json first
      if (conformOrder?.data?.check_in_date) {
        return conformOrder.data.check_in_date;
      }
      // Fall back to stays_quotes
      if (staysQuotes?.data?.check_in_date) {
        return staysQuotes.data.check_in_date;
      }
      return null;
    } catch (e) {
      console.error('Error parsing check-in date:', e);
      return null;
    }
  };
  // const getCheckInDate = (booking) => {
  //   try {
  //     if (booking.conform_order_json) {
  //       const conformOrder = JSON.parse(booking.conform_order_json);
  //       if (conformOrder.data && conformOrder.data.check_in_date) {
  //         return conformOrder.data.check_in_date;
  //       }
  //     }
      
  //     if (booking.stays_quotes) {
  //       const staysQuotes = JSON.parse(booking.stays_quotes);
  //       if (staysQuotes.data && staysQuotes.data.check_in_date) {
  //         return staysQuotes.data.check_in_date;
  //       }
  //     }
      
  //     return null;
  //   } catch (e) {
  //     console.error('Error parsing check-in date:', e);
  //     return null;
  //   }
  // };

  const getBookingStatus = (booking) => {
    try {
      const conformOrder = parseJSONData(booking.conform_order_json);
      // Check if conform_order_json contains a message instead of booking data
      if (conformOrder?.data?.message) {
        return 'pending_confirmation';
      }
      if (conformOrder?.data?.status) {
        return conformOrder.data.status;
      }
      return 'past';
    } catch (e) {
      console.error('Error parsing booking status:', e);
      return 'past';
    }

  };
  // const getBookingStatus = (booking) => {
  //   try {
  //     if (booking.conform_order_json) {
  //       const conformOrder = JSON.parse(booking.conform_order_json);
  //       return conformOrder.data?.status || 'past';
  //     }
  //     return 'past';
  //   } catch (e) {
  //     console.error('Error parsing booking status:', e);
  //     return 'past';
  //   }
  // };

  if (loading) {
    return (
      <section className="space-py-100">
        <Container>
          <div className="text-center py-5">
            <Spinner animation="border" role="status" variant="primary">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="mt-3">Loading your stay bookings...</p>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <>
      <section className="space-py-100">
        <Container>
          <Row>
            <Col md={9}>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="title mb-0 fs-4">Stays Order History</h4>
                {/*<button 
                  className="btn btn-outline-primary btn-sm"
                  onClick={fetchStaysBookings}
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>*/}
              </div>
              
              {error && (
                <Alert variant="danger" className="mb-4">
                  <strong>Error:</strong> {error}
                  <div className="mt-2">
                    <button 
                      className="btn btn-outline-danger btn-sm"
                      onClick={fetchStaysBookings}
                    >
                      Try Again
                    </button>
                  </div>
                </Alert>
              )}
              
              {bookings.length === 0 && !error ? (
                <div className="alert alert-info" role="alert">
                  You don't have any stay bookings yet.
                </div>
              ) : (
                <div className="table-container">
                  <table className="booking-table">
                    <thead>
                      <tr>
                        <th>BOOKING REF</th>
                        <th>STATUS</th>
                        <th>STAY</th>
                        <th>LOCATION</th>
                        <th>GUESTS</th>
                        <th>CHECK-IN</th>
                        <th>CREATION DATE</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => {
                        const stayInfo = getStayInfo(booking);
                        const location = stayInfo.location?.address;
                        const locationText = location ? 
                          `${location.city_name || ''}, ${location.country_code || ''}`.trim() : 
                          'N/A';
                        
                        const checkInDate = getCheckInDate(booking);
                        const status = getBookingStatus(booking);
                        
                        return (
                          <tr key={booking.id}>
                            <td>
                              <strong>{booking.booking_reference || 'N/A'}</strong>
                            </td>
                            <td>
                              {/*<span className={getStatusBadgeClass(status, booking.payment_status)}>
                                {getStatusText(status, booking.payment_status)}
                              </span>*/}
                              <span className={getStatusBadgeClass(booking)}>
                                {getStatusText(booking)}
                              </span>
                            </td>
                            <td>
                              <strong>{stayInfo.name}</strong>
                            </td>
                            <td>{locationText}</td>
                            <td>{getGuestNames(booking.guest_details)}</td>
                            <td>{formatDate(checkInDate)}</td>
                            <td>{getTimeAgo(booking.created_at)}</td>
                            <td>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => handleViewDetails(booking.booking_reference)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Col>
            <Col md={3}>
              <Userprofilesidebar />
            </Col>
          </Row>
        </Container>
      </section>
    </>
  );
}