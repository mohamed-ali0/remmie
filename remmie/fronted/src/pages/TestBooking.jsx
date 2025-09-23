import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner } from 'react-bootstrap';
import { IconPlane, IconPlaneTilt, IconCheck, IconX } from '@tabler/icons-react';
import axios from 'axios';

export default function TestBooking() {
  const [loading, setLoading] = useState({ oneWay: false, roundTrip: false, basic: false, duffelApi: false });
  const [results, setResults] = useState({ oneWay: null, roundTrip: null, basic: null, duffelApi: null });
  const [error, setError] = useState('');

  const handleTestBooking = async (type) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    setError('');
    setResults(prev => ({ ...prev, [type]: null }));

    try {
      let response;
      
      if (type === 'basic') {
        response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/stripe/test-basic`,
          { 
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}` 
            } 
          }
        );
      } else if (type === 'duffelApi') {
        response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/stripe/test-duffel-api`,
          { 
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}` 
            } 
          }
        );
      } else {
        response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/stripe/test-${type === 'oneWay' ? 'one-way' : 'round-trip'}-booking`,
          {},
          { 
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}` 
            } 
          }
        );
      }

      if (response.data.success) {
        setResults(prev => ({ 
          ...prev, 
          [type]: response.data 
        }));
        
        // Redirect to payment page (only for booking tests)
        if (type !== 'basic' && type !== 'duffelApi' && response.data.payment_url) {
          window.open(response.data.payment_url, '_blank');
        }
      } else {
        setError(`Failed to create ${type} booking: ${response.data.message}`);
      }
    } catch (err) {
      console.error(`Test ${type} booking error:`, err);
      setError(`Error creating ${type} booking: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const renderResult = (type, data) => {
    if (!data) return null;

    const isOneWay = type === 'oneWay';
    const flightData = data.mock_data;

    return (
      <Card className="mb-3">
        <Card.Header className="bg-success text-white">
          <IconCheck className="me-2" />
          {isOneWay ? 'One-Way' : 'Round-Trip'} Booking Created Successfully!
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6>Booking Details:</h6>
              <p><strong>Booking Reference:</strong> {data.booking_reference}</p>
              <p><strong>Passenger:</strong> {flightData.passengers[0].given_name} {flightData.passengers[0].family_name}</p>
              <p><strong>Email:</strong> {flightData.passengers[0].email}</p>
              <p><strong>Total Amount:</strong> ${flightData.total_amount} {flightData.currency}</p>
            </Col>
            <Col md={6}>
              <h6>Flight Details:</h6>
              {flightData.slices.map((slice, index) => (
                <div key={index} className="mb-2">
                  <p><strong>{index === 0 ? 'Departure' : 'Return'}:</strong></p>
                  <p>{slice.segments[0].origin.iata_code} → {slice.segments[0].destination.iata_code}</p>
                  <p>{slice.segments[0].operating_carrier.name} {slice.segments[0].operating_carrier_flight_number}</p>
                  <p>{new Date(slice.segments[0].departing_at).toLocaleDateString()} at {new Date(slice.segments[0].departing_at).toLocaleTimeString()}</p>
                </div>
              ))}
            </Col>
          </Row>
          <div className="mt-3">
            <Button 
              variant="primary" 
              onClick={() => window.open(data.payment_url, '_blank')}
              className="me-2"
            >
              Open Payment Page
            </Button>
            <Button 
              variant="outline-secondary" 
              onClick={() => navigator.clipboard.writeText(data.payment_url)}
            >
              Copy Payment URL
            </Button>
          </div>
        </Card.Body>
      </Card>
    );
  };

  return (
    <section className="space-pt-100 space-pb-100">
      <Container>
        <div className="text-center mb-5">
          <h1 className="mb-3">Booking Flow Test Page</h1>
          <p className="text-muted">
            Test the complete booking flow with real flight data from Duffel API. These endpoints 
            search for actual flights, create real bookings, and redirect to Stripe sandbox for payment testing.
          </p>
          
          {/* Test Buttons */}
          <div className="mb-4">
            <Button 
              variant="outline-primary" 
              onClick={() => handleTestBooking('basic')}
              disabled={loading.basic}
              className="me-2"
            >
              {loading.basic ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Testing...
                </>
              ) : (
                'Test Basic Connectivity'
              )}
            </Button>
            
            <Button 
              variant="outline-info" 
              onClick={() => handleTestBooking('duffelApi')}
              disabled={loading.duffelApi}
              className="me-2"
            >
              {loading.duffelApi ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Testing...
                </>
              ) : (
                'Test Duffel API'
              )}
            </Button>
            
            {results.basic && (
              <Alert variant="success" className="mt-2">
                <IconCheck className="me-2" />
                {results.basic.message}
              </Alert>
            )}
            
            {results.duffelApi && (
              <Alert variant={results.duffelApi.success ? "success" : "danger"} className="mt-2">
                <IconCheck className="me-2" />
                {results.duffelApi.message}
                {results.duffelApi.error && (
                  <div className="mt-2">
                    <strong>Error Details:</strong>
                    <pre className="mt-1" style={{fontSize: '12px', backgroundColor: '#f8f9fa', padding: '8px', borderRadius: '4px'}}>
                      {JSON.stringify(results.duffelApi.error, null, 2)}
                    </pre>
                  </div>
                )}
              </Alert>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="danger" className="mb-4">
            <IconX className="me-2" />
            {error}
          </Alert>
        )}

        <Row>
          {/* One-Way Booking Test */}
          <Col lg={6} className="mb-4">
            <Card className="h-100">
              <Card.Header className="bg-primary text-white">
                <IconPlane className="me-2" />
                One-Way Booking Test
              </Card.Header>
              <Card.Body>
                <h5 className="card-title">LAX → JFK</h5>
                <p className="card-text">
                  <strong>Passenger:</strong> John Doe (Male, Adult)<br/>
                         <strong>Date:</strong> December 15, 2025<br/>
                  <strong>Airline:</strong> American Airlines (AA1234)<br/>
                  <strong>Price:</strong> $539.50
                </p>
                <p className="text-muted small">
                  This will search for real flights, create a real booking in the database, 
                  and redirect you to Stripe checkout for payment testing.
                </p>
                <Button 
                  variant="primary" 
                  onClick={() => handleTestBooking('oneWay')}
                  disabled={loading.oneWay}
                  className="w-100"
                >
                  {loading.oneWay ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Creating Booking...
                    </>
                  ) : (
                    <>
                      <IconPlane className="me-2" />
                      Test One-Way Booking
                    </>
                  )}
                </Button>
              </Card.Body>
            </Card>
            {renderResult('oneWay', results.oneWay)}
          </Col>

          {/* Round-Trip Booking Test */}
          <Col lg={6} className="mb-4">
            <Card className="h-100">
              <Card.Header className="bg-success text-white">
                <IconPlaneTilt className="me-2" />
                Round-Trip Booking Test
              </Card.Header>
              <Card.Body>
                <h5 className="card-title">JFK ↔ LAX</h5>
                <p className="card-text">
                  <strong>Passenger:</strong> Jane Smith (Female, Adult)<br/>
                         <strong>Departure:</strong> December 20, 2025<br/>
                         <strong>Return:</strong> December 27, 2025<br/>
                  <strong>Airlines:</strong> Delta (DL5678) + United (UA9012)<br/>
                  <strong>Price:</strong> $865.80
                </p>
                <p className="text-muted small">
                  This will search for real round-trip flights, create a real booking in the database, 
                  and redirect you to Stripe checkout for payment testing.
                </p>
                <Button 
                  variant="success" 
                  onClick={() => handleTestBooking('roundTrip')}
                  disabled={loading.roundTrip}
                  className="w-100"
                >
                  {loading.roundTrip ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Creating Booking...
                    </>
                  ) : (
                    <>
                      <IconPlaneTilt className="me-2" />
                      Test Round-Trip Booking
                    </>
                  )}
                </Button>
              </Card.Body>
            </Card>
            {renderResult('roundTrip', results.roundTrip)}
          </Col>
        </Row>

        {/* Instructions */}
        <Row className="mt-5">
          <Col>
            <Card>
              <Card.Header>
                <h5 className="mb-0">Testing Instructions</h5>
              </Card.Header>
              <Card.Body>
                <ol>
                  <li>Make sure you're logged in to your account</li>
                  <li>Click either "Test One-Way Booking" or "Test Round-Trip Booking"</li>
                  <li>The system will create mock booking data and redirect you to Stripe checkout</li>
                  <li>Use Stripe test cards:
                    <ul className="mt-2">
                      <li><strong>Success:</strong> 4242 4242 4242 4242</li>
                      <li><strong>Decline:</strong> 4000 0000 0000 0002</li>
                      <li>Use any future expiry date and any 3-digit CVC</li>
                    </ul>
                  </li>
                  <li>After successful payment, you'll be redirected to the booking success page</li>
                  <li>The success page will show all booking details including flight information</li>
                </ol>
                <div className="alert alert-info mt-3">
                  <strong>Note:</strong> These test bookings use real flight data from Duffel sandbox API. 
                  Real bookings are created in the database, but no actual tickets will be issued since 
                  we're using sandbox/test environment.
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </section>
  );
}
