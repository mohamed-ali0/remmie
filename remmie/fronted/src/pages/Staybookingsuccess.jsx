import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Accordion, Form, Table, Card, Row, Col, Badge, Spinner } from 'react-bootstrap';
import { IconHistory, IconTicket, IconPlaneTilt, IconClock, IconChevronUp } from '@tabler/icons-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import travel_img from '/src/assets/images/travel_img.png';
import { format, parseISO } from 'date-fns';

export default function Staybookingsuccess() {
  
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
          `${import.meta.env.VITE_API_BASE_URL}/api/stripe/confirm-stay-Payment`,
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

          const oldData = JSON.parse(data.booking_json).data; // booking_json.data
            const guestDetails = JSON.parse(data.guest_details); // guest_details object

            // Build the new payload
            const confirmOrderPayload = {
              id: data.id, // keep original id
              data: {
                quote_id: oldData.quote_id,
                guests: guestDetails.guests.map(g => ({
                  given_name: g.given_name,
                  family_name: g.family_name,
                  born_on: g.born_on
                })),
                email: guestDetails.email,
                stay_special_requests: guestDetails.stay_special_requests,
                phone_number: guestDetails.phone_number
              }
            };

            // Send to API
            const orderResponse = await axios.post(
              'https://remmie.co:5000/api/stays/create-conform-order',
              confirmOrderPayload,
              { headers: { 'Content-Type': 'application/json' } }
            );

            setOrderData(orderResponse.data.data);
            setStatus('Stay booking confirmed!');
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

 // Helper functions

   

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return format(parseISO(dateString), 'd MMM yyyy');
    };

    const countGuests = () => {
        if (!orderData?.guest_types) return { adults: 0, children: 0 };
        const adults = orderData.guest_types.filter(g => g.type === 'adult').length;
        const children = orderData.guest_types.filter(g => g.type === 'child').length;
        return { adults, children };
    };

    const getRoomRate = () => {
        if (!orderData?.accommodation?.rooms?.[0]?.rates?.[0]) return null;
        return orderData.accommodation.rooms[0].rates[0];
    };

    if (loading) {
        return (

            <Container className="py-5 text-center">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p>Loading booking details...</p>
            </Container>

        );

    }



    if (error) {

        return (
            <Container className="py-5">
                <div className="alert alert-danger">{error}</div>
                <Link to="/" className="btn btn-primary">Back to Home</Link>
            </Container>

        );

    }



    if (!orderData) {

        return (

            <Container className="py-5">

                <div className="alert alert-info">{status || 'No booking data available'}</div>

                <Link to="/" className="btn btn-primary">Back to Home</Link>

            </Container>

        );

    }

    if (orderData.message) {
        return (
            <Container className="py-5">
                <div className="alert alert-info">{orderData.message}</div>
                <Link to="/staysorderhistory" className="btn btn-primary">Back to Stays Order History</Link>
            </Container>
        );
    }
  return (
        <Container className="py-5">
            <h1 className="mb-4">Booking Confirmation</h1>
            
            {status && (
                <div className={`alert ${status.includes('Thank you') ? 'alert-success' : 'alert-info'} mb-4`}>
                    {status}
                </div>
            )}

            <Card className="mb-4">
                <Card.Header className="bg-light">
                    <h4 className="mb-0">Booking Reference: {orderData.reference}</h4>
                </Card.Header>
                <Card.Body>
                    <Badge bg="success" className="mb-3">Confirmed</Badge>
                    
                    <Row>
                        <Col md={8}>
                            <div className="d-flex mb-4">
                                <img 
                                    src={orderData.accommodation.photos[0].url} 
                                    alt={orderData.accommodation.name} 
                                    className="img-fluid rounded me-4" 
                                    style={{ width: '200px', height: '150px', objectFit: 'cover' }}
                                />
                                <div>
                                    <h3>{orderData.accommodation.name}</h3>
                                    <p className="text-muted">
                                        {[
                                            orderData.accommodation.location.address.line_one,
                                            orderData.accommodation.location.address.city_name,
                                            orderData.accommodation.location.address.postal_code
                                        ].filter(Boolean).join(', ')}
                                    </p>
                                    <div className="d-flex align-items-center">
                                        <span className="me-2">
                                            {[...Array(5)].map((_, i) => (
                                                <i 
                                                    key={i} 
                                                    className={`ti ti-star${i < orderData.accommodation.rating ? ' text-warning' : ' text-muted'}`}
                                                />
                                            ))}
                                        </span>
                                        <span>{orderData.accommodation.review_score}/10</span>
                                    </div>
                                </div>
                            </div>

                            <Row className="mb-4">
                                <Col md={6}>
                                    <Card>
                                        <Card.Body>
                                            <h5>Check-in</h5>
                                            <p className="mb-1"><strong>{formatDate(orderData.check_in_date)}</strong></p>
                                            <p className="text-muted">From {orderData.accommodation.check_in_information.check_in_after_time}</p>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={6}>
                                    <Card>
                                        <Card.Body>
                                            <h5>Check-out</h5>
                                            <p className="mb-1"><strong>{formatDate(orderData.check_out_date)}</strong></p>
                                            <p className="text-muted">Until {orderData.accommodation.check_in_information.check_out_before_time}</p>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            <Card className="mb-4">
                                <Card.Header>
                                    <h5>Guest Details</h5>
                                </Card.Header>
                                <Card.Body>
                                    <Table striped>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Type</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orderData.guests.map((guest, index) => (
                                                <tr key={index}>
                                                    <td>{guest.given_name} {guest.family_name}</td>
                                                    <td>{orderData.guest_types[index].type}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>

                            <Card className="mb-4">
                                <Card.Header>
                                    <h5>Key Collection</h5>
                                </Card.Header>
                                <Card.Body>
                                    <p>{orderData.accommodation.key_collection.instructions}</p>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={4}>
                            <Card className="mb-4">
                                <Card.Header>
                                    <h5>Price Summary</h5>
                                </Card.Header>
                                <Card.Body>
                                    <Table borderless>
                                        <tbody>
                                            <tr>
                                                <td>Room(s)</td>
                                                <td className="text-end">{orderData.rooms}x</td>
                                            </tr>
                                            <tr>
                                                <td>Base Price</td>
                                                <td className="text-end">
                                                    {getRoomRate().base_currency}{getRoomRate().base_amount}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Taxes</td>
                                                <td className="text-end">
                                                    {getRoomRate().tax_currency}{getRoomRate().tax_amount}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Fees</td>
                                                <td className="text-end">
                                                    {getRoomRate().fee_currency}{getRoomRate().fee_amount}
                                                </td>
                                            </tr>
                                            <tr className="fw-bold">
                                                <td>Total</td>
                                                <td className="text-end">
                                                    {getRoomRate().total_currency}{getRoomRate().total_amount}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>

                            <Card>
                                <Card.Header>
                                    <h5>Contact Information</h5>
                                </Card.Header>
                                <Card.Body>
                                    <p><strong>Email:</strong> {orderData.email}</p>
                                    <p><strong>Phone:</strong> {orderData.phone_number}</p>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    <Accordion activeKey={activeKey} onSelect={handleToggle} className="mt-4">
                        <Accordion.Item eventKey="0">
                            <Accordion.Header>
                                <IconChevronUp className={`me-2 ${activeKey === '0' ? 'rotate-180' : ''}`} />
                                Amenities
                            </Accordion.Header>
                            <Accordion.Body>
                                <div className="d-flex flex-wrap">
                                    {orderData.accommodation.amenities.map((amenity, index) => (
                                        <Badge key={index} bg="light" text="dark" className="me-2 mb-2">
                                            {amenity.description}
                                        </Badge>
                                    ))}
                                </div>
                            </Accordion.Body>
                        </Accordion.Item>

                        <Accordion.Item eventKey="1">
                            <Accordion.Header>
                                <IconChevronUp className={`me-2 ${activeKey === '1' ? 'rotate-180' : ''}`} />
                                Conditions
                            </Accordion.Header>
                            <Accordion.Body>
                                {getRoomRate().conditions.map((condition, index) => (
                                    <div key={index} className="mb-3">
                                        <h6>{condition.title}</h6>
                                        <p>{condition.description}</p>
                                    </div>
                                ))}
                            </Accordion.Body>
                        </Accordion.Item>
                    </Accordion>
                </Card.Body>
            </Card>

            <div className="text-center mt-4">
                <Link to="/" className="btn btn-primary me-2">Back to Home</Link>
                {/*<Link to="/my-bookings" className="btn btn-outline-primary">View All Bookings</Link>*/}
            </div>
        </Container>
  );
}
