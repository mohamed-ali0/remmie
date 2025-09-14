import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Spinner, Badge } from 'react-bootstrap';
import { IconChevronRight } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getToken,checkAndLogoutIfExpired } from '../utils/auth';
import Userprofilesidebar from '../components/Userprofilesidebar';


const FlightBookingCard = ({ booking }) => {
  // Parse flight data from flight_offers
  const parseFlightData = () => {
    try {
      const data = JSON.parse(booking.flight_offers);
      if (!data.data?.slices?.length) return null;
      
      const outbound = data.data.slices[0];
      const returnSegment = data.data.slices.length > 1 ? data.data.slices[1] : null;
      
      return {
        origin: outbound.origin.iata_code,
        destination: outbound.destination.iata_code,
        outboundDate: outbound.segments[0].departing_at,
        returnDate: returnSegment?.segments[0]?.departing_at,
        carrier: outbound.segments[0].operating_carrier.name,
        isRoundTrip: returnSegment !== null,
        duration: outbound.duration,
        passengers: data.data.passengers?.length || 0
      };
    } catch (e) {
      console.error("Error parsing flight data:", e);
      return null;
    }
  };

  // Parse booking confirmation data
  const parseConformOrder = () => {
    try {
      return booking.conform_order_json ? JSON.parse(booking.conform_order_json) : null;
    } catch (e) {
      console.error("Error parsing conform order:", e);
      return null;
    }
  };

  const flightData = parseFlightData();
  const conformOrder = parseConformOrder();

  if (!flightData) return null;

  // Get booking status
  const bookingReference = conformOrder?.data?.booking_reference || booking.booking_reference;
  const isCancelled = conformOrder?.data?.cancellation !== null;
  const paidAt = conformOrder?.data?.payment_status?.paid_at;
  const status = isCancelled ? 'Cancelled' : paidAt ? 'Confirmed' : 'Pending';

  // Format date and time
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
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

  // Format duration (PT2H10M → 2h 10m)
  const formatDuration = (duration) => {
    const hours = duration.match(/(\d+)H/)?.[1] || '0';
    const minutes = duration.match(/(\d+)M/)?.[1] || '0';
    return `${hours}h ${minutes}m`;
  };

  return (
    <Card className='p-3 mt-4'>
      <Card.Header className='px-0 bg-transparent'>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className='text-secondary fw-bolder mb-1'>
              {flightData.origin} → {flightData.destination}
              {flightData.isRoundTrip && ` → ${flightData.origin}`}
            </h4>
            <div className="d-flex align-items-center gap-2">
              <small className='text-muted'>Ref: {bookingReference}</small>
              <Badge bg={status === 'Confirmed' ? 'success' : status === 'Cancelled' ? 'danger' : 'warning'}>
                {status}
              </Badge>
            </div>
          </div>
          <div className='text-end'>
            <p className='mb-0'><strong>{flightData.carrier}</strong></p>
            <p className='text-muted mb-0'><small>{flightData.passengers} passengers</small></p>
          </div>
        </div>
      </Card.Header>
      
      <Card.Body className='px-0 py-2'>
        <div className="d-flex justify-content-between mb-2">
          <div>
            <p className='mb-1'>
              <strong>Depart:</strong> {formatDate(flightData.outboundDate)} at {formatTime(flightData.outboundDate)}
              <span className='text-muted ms-2'>({formatDuration(flightData.duration)})</span>
            </p>
            {flightData.isRoundTrip && (
              <p className='mb-0'>
                <strong>Return:</strong> {formatDate(flightData.returnDate)} at {formatTime(flightData.returnDate)}
              </p>
            )}
          </div>
          <div className='text-end'>
            <p className='mb-0'>
              <strong>Total:</strong> {booking.currency} {booking.amount}
            </p>
            {paidAt && (
              <p className='text-muted mb-0'><small>Paid on {formatDate(paidAt)}</small></p>
            )}
          </div>
        </div>
        
        <div className='d-flex justify-content-between align-items-center mt-3'>
          <div>
            {conformOrder?.data?.documents?.length > 0 && (
              <Badge bg="info" className='me-2'>
                E-Tickets: {conformOrder.data.documents.length}
              </Badge>
            )}
          </div>
          
          <Link 
            to={`/booking-details?booking_ref=${booking.booking_reference}`} 
            className='view_details_btn btn btn-outline-primary px-4 py-2'
          >
            View Details
          </Link>
        </div>
      </Card.Body>
    </Card>
  );
};

export default function flightorderhistory() {
  const navigate = useNavigate(); 
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      if (checkAndLogoutIfExpired(navigate)) return;
      const token = getToken();
      try {
        const response = await axios.post(
          '/api/booking/get-user-booking-list',
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          setBookings(response.data.bookings.filter(booking => booking.flight_offers));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

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
        Error loading bookings: {error}
      </div>
    );
  }

  return (
    <section className='space-py-100'>
      <Container>
        <Row>
          <Col md={9}>
            <h4 className='title pb-2 mb-0 fs-4'>Your Flight Bookings</h4>
            <p className='text-muted'>View and manage your flight reservations</p>
            
            {bookings.length === 0 ? (
              <Card className='p-3 mt-4'>
                <Card.Body>
                  <p className='text-center text-muted'>No flight bookings found</p>
                </Card.Body>
              </Card>
            ) : (
              bookings.map((booking) => (
                <FlightBookingCard key={booking.id} booking={booking} />
              ))
            )}
          </Col>
          
          <Col md={3}>
            <Userprofilesidebar/>
          </Col>
        </Row>
      </Container>
    </section>
  );
}