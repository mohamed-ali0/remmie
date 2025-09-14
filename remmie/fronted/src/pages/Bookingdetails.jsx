import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Spinner, Badge, Table, Button } from 'react-bootstrap';
import { IconChevronLeft } from '@tabler/icons-react';
import axios from 'axios';
import { getToken,checkAndLogoutIfExpired } from '../utils/auth';




const BookingDetails = () => {
  const { booking_ref } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      try {
        const response = await axios.post(
          'https://remmie.co:5000/api/booking/get-user-single-booking',
          { booking_ref: ref },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.success) {
          setBooking(response.data.booking);
        } else {
          setError('No booking found.');
        }
      } catch (err) {
        setError('Something went wrong: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, []); // ✅ Remove booking_ref dependency

  

  const parseFlightData = () => {
    if (!booking?.flight_offers) return null;
    
    try {
      const data = JSON.parse(booking.flight_offers);
      if (!data.data?.slices?.length) return null;
      
      return data.data.slices.map(slice => ({
        origin: slice.origin,
        destination: slice.destination,
        segments: slice.segments,
        duration: slice.duration,
        conditions: slice.conditions
      }));
    } catch (e) {
      console.error("Error parsing flight data:", e);
      return null;
    }
  };

  const parsePassengerData = () => {
    if (!booking?.conform_order_json) return null;
    
    try {
      const data = JSON.parse(booking.conform_order_json);
      return data.data?.passengers || [];
    } catch (e) {
      console.error("Error parsing passenger data:", e);
      return null;
    }
  };

  const parseBookingDetails = () => {
    if (!booking?.conform_order_json) return null;
    
    try {
      return JSON.parse(booking.conform_order_json)?.data || null;
    } catch (e) {
      console.error("Error parsing booking details:", e);
      return null;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (duration) => {
    const hours = duration.match(/(\d+)H/)?.[1] || '0';
    const minutes = duration.match(/(\d+)M/)?.[1] || '0';
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger mt-5">
        Error loading booking details: {error}
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="alert alert-warning mt-5">
        Booking not found
      </div>
    );
  }

  const flightSegments = parseFlightData();
  const passengers = parsePassengerData();
  const bookingDetails = parseBookingDetails();

  return (
    <Container className="py-5">
      <Button 
        variant="link" 
        onClick={() => navigate(-1)} 
        className="mb-4 d-flex align-items-center"
      >
        <IconChevronLeft size={20} /> Back to bookings
      </Button>

      <h2 className="mb-4">Booking Details</h2>
      
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">
            Booking Reference: <strong>{booking.booking_reference}</strong>
          </h4>
          <Badge bg={booking.payment_status === 'succeeded' ? 'success' : 'warning'}>
            {booking.payment_status === 'succeeded' ? 'Paid' : 'Pending'}
          </Badge>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <p><strong>Booking Date:</strong> {formatDate(booking.created_at)}</p>
              <p><strong>Total Amount:</strong> {booking.currency} {booking.amount}</p>
            </Col>
            <Col md={6}>
              {bookingDetails?.payment_status?.paid_at && (
                <p><strong>Payment Date:</strong> {formatDate(bookingDetails.payment_status.paid_at)}</p>
              )}
              {bookingDetails?.documents?.length > 0 && (
                <p>
                  <strong>E-Tickets:</strong> {bookingDetails.documents.length} issued
                </p>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {flightSegments?.map((segment, index) => (
        <Card key={index} className="mb-4">
          <Card.Header>
            <h4 className="mb-0">
              {segment.origin.city_name} ({segment.origin.iata_code}) to {segment.destination.city_name} ({segment.destination.iata_code})
            </h4>
          </Card.Header>
          <Card.Body>
            {segment.segments.map((flight, flightIndex) => (
              <div key={flightIndex} className={flightIndex > 0 ? 'mt-4' : ''}>
                <div className="d-flex justify-content-between mb-3">
                  <div>
                    <h5>
                      {formatTime(flight.departing_at)} - {formatTime(flight.arriving_at)}
                      <span className="ms-2 text-muted">{flight.marketing_carrier.name}</span>
                    </h5>
                    <p className="mb-1">
                      <strong>Flight:</strong> {flight.marketing_carrier_flight_number}
                    </p>
                    <p className="mb-1">
                      <strong>Duration:</strong> {formatDuration(flight.duration)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="mb-1">
                      <strong>Depart:</strong> {formatDate(flight.departing_at)}
                    </p>
                    <p className="mb-1">
                      <strong>Terminal:</strong> {flight.origin_terminal} → {flight.destination_terminal}
                    </p>
                  </div>
                </div>

                <div className="border-top pt-3">
                  <p className="mb-1">
                    <strong>Departure:</strong> {flight.origin.name} ({flight.origin.iata_code})
                  </p>
                  <p className="mb-1">
                    <strong>Arrival:</strong> {flight.destination.name} ({flight.destination.iata_code})
                  </p>
                </div>

                {segment.conditions?.change_before_departure && (
                  <div className="mt-3 p-3 bg-light rounded">
                    <p className="mb-0">
                      <strong>Change Policy:</strong> {segment.conditions.change_before_departure.allowed ? 
                        `Changes allowed with penalty of ${segment.conditions.change_before_departure.penalty_amount} ${segment.conditions.change_before_departure.penalty_currency}` : 
                        'Changes not allowed'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </Card.Body>
        </Card>
      ))}

      {passengers?.length > 0 && (
        <Card className="mb-4">
          <Card.Header>
            <h4 className="mb-0">Passenger Details</h4>
          </Card.Header>
          <Card.Body>
            <Table striped bordered>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Date of Birth</th>
                </tr>
              </thead>
              <tbody>
                {passengers.map((passenger, index) => (
                  <tr key={index}>
                    <td>{passenger.title} {passenger.given_name} {passenger.family_name}</td>
                    <td>{passenger.type || 'Adult'}</td>
                    <td>{passenger.email}</td>
                    <td>{passenger.phone_number}</td>
                    <td>{passenger.born_on ? formatDate(passenger.born_on) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {bookingDetails && (
        <Card className="mb-4">
          <Card.Header>
            <h4 className="mb-0">Fare Breakdown</h4>
          </Card.Header>
          <Card.Body>
            <Table striped bordered>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Base Fare</td>
                  <td className="text-end">{bookingDetails.base_currency} {bookingDetails.base_amount}</td>
                </tr>
                <tr>
                  <td>Taxes & Fees</td>
                  <td className="text-end">{bookingDetails.tax_currency} {bookingDetails.tax_amount}</td>
                </tr>
                <tr className="table-active">
                  <td><strong>Total</strong></td>
                  <td className="text-end"><strong>{bookingDetails.total_currency} {bookingDetails.total_amount}</strong></td>
                </tr>
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/*<div className="d-flex gap-3">
        {bookingDetails?.available_actions?.includes('change') && (
          <Button variant="outline-primary">Change Booking</Button>
        )}
        {bookingDetails?.available_actions?.includes('cancel') && (
          <Button variant="outline-danger">Cancel Booking</Button>
        )}
      </div>*/}
    </Container>
  );
};

export default BookingDetails;