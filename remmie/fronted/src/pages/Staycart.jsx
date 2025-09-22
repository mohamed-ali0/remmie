import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Row, Col, Card, Form, InputGroup, Button, Alert } from 'react-bootstrap';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import { format, parseISO } from 'date-fns';
import * as TablerIcons from '@tabler/icons-react';
import { getToken, checkAndLogoutIfExpired } from '../utils/auth';

const StayCart = () => {
    const navigate = useNavigate();
    const [bookingRef, setBookingRef] = useState('');
    const [guestsDetails, setGuestsDetails] = useState([]);
    const [stayDetails, setStayDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
    const [formData, setFormData] = useState({
        guests: [],
        email: '',
        phone_number: '',
        stay_special_requests: ''
    });

    // Validation rules
    const validateForm = () => {
        const errors = {};
        let isValid = true;

        // Validate each guest
        formData.guests.forEach((guest, index) => {
            if (!guest.given_name || guest.given_name.trim() === '') {
                errors[`guest_${index}_given_name`] = 'First name is required';
                isValid = false;
            }
            if (!guest.family_name || guest.family_name.trim() === '') {
                errors[`guest_${index}_family_name`] = 'Last name is required';
                isValid = false;
            }
            if (!guest.born_on) {
                errors[`guest_${index}_born_on`] = 'Birth date is required';
                isValid = false;
            }
        });

        // Validate email
        if (!formData.email || formData.email.trim() === '') {
            errors.email = 'Email is required';
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Please enter a valid email address';
            isValid = false;
        }

        // Validate phone number
        if (!formData.phone_number || formData.phone_number.trim() === '') {
            errors.phone_number = 'Phone number is required';
            isValid = false;
        } else if (!/^[\d\s+\-()]{8,20}$/.test(formData.phone_number)) {
            errors.phone_number = 'Please enter a valid phone number';
            isValid = false;
        }

        setValidationErrors(errors);
        return isValid;
    };

    // Update the handleInputChange function to handle date changes
    const handleDateChange = (date, index) => {
        const newGuests = [...formData.guests];
        newGuests[index].born_on = date;
        setFormData({
            ...formData,
            guests: newGuests
        });
        
        // Clear validation error when user selects a date
        if (validationErrors[`guest_${index}_born_on`]) {
            const newErrors = {...validationErrors};
            delete newErrors[`guest_${index}_born_on`];
            setValidationErrors(newErrors);
        }


    };

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
                const { data: bookingData } = await axios.post(
                    `${import.meta.env.VITE_API_URL}/api/booking/get-booking-byref`,
                    { booking_ref: ref },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                const bookingJson = typeof bookingData.booking_json === 'string' 
                    ? JSON.parse(bookingData.booking_json) 
                    : bookingData.booking_json;

                if (bookingData.booking_type != "stays") {
                    setError('Wrong Booking reference missing in URL');
                    setLoading(false);
                    return;
                }

                setGuestsDetails(bookingJson.data || []);
                setFormData({
                    guests: bookingJson.data?.guests || [],
                    email: bookingJson.data?.email || '',
                    phone_number: bookingJson.data?.phone_number || '',
                    stay_special_requests: bookingJson.data?.stay_special_requests || ''
                });

                if (bookingJson.data?.quote_id != '') {
                    const quoteId = bookingJson.data.quote_id;
                    
                    const { data: stayData } = await axios.post(
                        `${import.meta.env.VITE_API_URL}/api/stays/stays-quotes-by-id?quote_id=${quoteId}`,
                        {},
                        { headers: { Authorization: `Bearer ${token}` } }
                    );

                    // Send to backend
                   await axios.post(`${import.meta.env.VITE_API_URL}/api/stays/save-stay-amount`, {
                      data: {
                        booking_id: bookingData.id,
                        stays_quotes:stayData,
                        base_amount: stayData?.data.base_amount,
                        tax_amount: stayData?.data.tax_amount,
                        total_amount: stayData?.data.total_amount,
                        currency: stayData?.data.total_currency,
                      }
                    }, {
                      headers: {
                        'Content-Type': 'application/json'
                      }
                    });

                    setStayDetails(stayData);
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

    const handleInputChange = (e, index, field) => {
        const newGuests = [...formData.guests];
        newGuests[index][field] = e.target.value;
        setFormData({
            ...formData,
            guests: newGuests
        });
        
        // Clear validation error when user types
        if (validationErrors[`guest_${index}_${field}`]) {
            const newErrors = {...validationErrors};
            delete newErrors[`guest_${index}_${field}`];
            setValidationErrors(newErrors);
        }
    };

    const handleContactChange = (e, field) => {
        setFormData({
            ...formData,
            [field]: e.target.value
        });
        
        // Clear validation error when user types
        if (validationErrors[field]) {
            const newErrors = {...validationErrors};
            delete newErrors[field];
            setValidationErrors(newErrors);
        }
    };

    const handleSpecialRequestsChange = (e) => {
        setFormData({
            ...formData,
            stay_special_requests: e.target.value
        });
    };

    const handlePayment = async () => {
        if (checkAndLogoutIfExpired(navigate)) return;
        
        // Validate form before proceeding
        if (!validateForm()) {
            return;
        }
        
        const token = getToken();
        setLoading(true);
        
        try {
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/api/stripe/create-stay-payment-session`,
                {
                    booking_ref: bookingRef,
                    guest_details: {
                        guests: formData.guests,
                        email: formData.email,
                        phone_number: formData.phone_number,
                        stay_special_requests: formData.stay_special_requests
                    },
                    payment_method: 'balance'
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            window.location.href = response.data.url; // Redirect to booking success
           
        } catch (error) {
            console.error('Payment error:', error);
            setError(error.response?.data?.message || 'Payment processing failed');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <p>Loading booking details...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;
    if (!guestsDetails || !stayDetails) return <p>No booking data found</p>;

    // Format date for display
    const formatDateDisplay = (dateString, timeZone = 'UTC') => {
        const date = parseISO(dateString);
        return {
            date: format(date, 'd MMM yyyy'),
            time: format(date, 'h:mm a') + ' ' + timeZone
        };
    };

    // Count adults and children
    const countGuests = () => {
        const adults = stayDetails?.data?.guests?.filter(g => g.type === 'adult').length || 0;
        const children = stayDetails?.data?.guests?.filter(g => g.type === 'child').length || 0;
        return { adults, children };
    };

    return (
        <>
            {/* Start Contact */}
            <section className='staycart_sec space-py-50'>
                <Container>
                    <h1 className="stay_title">Checkout</h1>
                    <Row>
                        <Col md={8}>
                            <div className="booking_details mb-4">
                                <h4 className="mb-3 stay_sub_title">Booking details</h4>
                                <Card className="border rounded-3">
                                    <Card.Body>
                                        <div className="booking_review mb-4">
                                            <div className="img_cart">
                                                <img src={stayDetails?.data?.accommodation?.photos?.[0]?.url || ''} alt="" className='img-fluid' />
                                            </div>
                                            <div className="booking_contact">
                                               <ul className="review_icon">
                                                    {[...Array(5)].map((_, index) => (
                                                        <li key={index}>
                                                          <i className={`ti ti-star ${index < stayDetails?.data?.accommodation?.rating ? '' : 'font-light'}`}></i>
                                                        </li>
                                                      ))}
                                               </ul> 
                                               <h5 className="sub_title">{stayDetails?.data?.accommodation?.name || ''}</h5>    
                                               <p className="sub_test">
                                                  {[ 
                                                    stayDetails?.data?.accommodation?.location?.address?.line_one,
                                                    stayDetails?.data?.accommodation?.location?.address?.city_name,
                                                    stayDetails?.data?.accommodation?.location?.address?.postal_code
                                                  ].filter(Boolean).join(', ')}
                                                </p>
                                            </div>
                                        </div>
                                        <ul className="list_test">
                                            <li className="list_icon">
                                                <div className="icon_list icon_text">{stayDetails?.data?.rooms}x</div>
                                                <p className="list_text">Successful Booking</p>
                                            </li>
                                            <li className="list_icon">
                                                <div className="icon_list"><i className='ti ti-tools-kitchen'></i></div>
                                                    <p className="list_text">
                                                        {stayDetails?.data?.accommodation?.rooms?.[0]?.rates?.[0]?.board_type?.replace(/_/g, ' ') || 'Board Info'}
                                                    </p>
                                            </li>
                                        </ul>
                                        <Row className="status_check pt-3">
                                          <Col sm={6}>
                                            <div className="status_contact">
                                              <p>Check in</p>
                                              <h6>{new Date(stayDetails?.data?.check_in_date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</h6>
                                              <p>from {stayDetails?.data?.accommodation?.check_in_information?.check_in_after_time}</p>
                                            </div>
                                          </Col>
                                          <Col sm={6} className="border-start">
                                            <div className="status_contact">
                                              <p>Check out</p>
                                              <h6>{new Date(stayDetails?.data?.check_out_date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</h6>
                                              <p>until {stayDetails?.data?.accommodation?.check_in_information?.check_out_before_time}</p>
                                            </div>
                                          </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>
                            </div>
                            <div className="key_collection mb-4">
                                <h4 className="mb-3 stay_sub_title">Key collection</h4>
                                <Card className="border rounded-3">
                                    <Card.Body>
                                        <p className="key_text">Instructions</p>
                                        <h6 className="key_title">{stayDetails?.data?.key_collection?.instructions || 'Collection details not available'}</h6>
                                    </Card.Body>
                                </Card>
                            </div>
                            <div className="from_details mb-4">
                                <h4 className="mb-3 stay_sub_title">Guest details</h4>
                                <div className="guest_from">
                                    <Row>
                                        <Col lg={8}>
                                        {(formData.guests || []).map((guest, index) => (
                                            <Row key={`guest-${index}`}>
                                                <Col sm={12}>
                                                    <p className="guest_text">Guest {index + 1}</p>
                                                </Col>
                                                <Col sm={6} className="mb-4">
                                                    <Form.Group>
                                                        <Form.Label>First name</Form.Label>
                                                        <Form.Control 
                                                            className={`rounded-3 ${validationErrors[`guest_${index}_given_name`] ? 'is-invalid' : ''}`} 
                                                            type="text" 
                                                            value={guest.given_name || ''} 
                                                            onChange={(e) => handleInputChange(e, index, 'given_name')}
                                                            placeholder="Abby" 
                                                        />
                                                        {validationErrors[`guest_${index}_given_name`] && (
                                                            <Form.Control.Feedback type="invalid">
                                                                {validationErrors[`guest_${index}_given_name`]}
                                                            </Form.Control.Feedback>
                                                        )}
                                                    </Form.Group>
                                                </Col>
                                                <Col sm={6} className="mb-4">
                                                    <Form.Group>
                                                        <Form.Label>Last name</Form.Label>
                                                        <Form.Control 
                                                            className={`rounded-3 ${validationErrors[`guest_${index}_family_name`] ? 'is-invalid' : ''}`} 
                                                            type="text" 
                                                            value={guest.family_name || ''} 
                                                            onChange={(e) => handleInputChange(e, index, 'family_name')}
                                                            placeholder="Carpenter" 
                                                        />
                                                        {validationErrors[`guest_${index}_family_name`] && (
                                                            <Form.Control.Feedback type="invalid">
                                                                {validationErrors[`guest_${index}_family_name`]}
                                                            </Form.Control.Feedback>
                                                        )}
                                                    </Form.Group>
                                                </Col>
                                                <Col sm={6} className="mb-4">
                                                    <Form.Group>
                                                        <Form.Label>Date of Birth</Form.Label>
                                                        <DatePicker
                                                            selected={guest.born_on ? new Date(guest.born_on) : null}
                                                            onChange={(date) => handleDateChange(date, index)}
                                                            dateFormat="dd-MM-yyyy"
                                                            className={`form-control rounded-3 ${validationErrors[`guest_${index}_born_on`] ? 'is-invalid' : ''}`}
                                                            placeholderText="Select birth date"
                                                            maxDate={new Date()} // Can't select future dates
                                                            showYearDropdown
                                                            scrollableYearDropdown
                                                            yearDropdownItemNumber={100}
                                                            dropdownMode="select"
                                                        />
                                                        {validationErrors[`guest_${index}_born_on`] && (
                                                            <Form.Control.Feedback type="invalid">
                                                                {validationErrors[`guest_${index}_born_on`]}
                                                            </Form.Control.Feedback>
                                                        )}
                                                    </Form.Group>
                                                </Col>
                                            </Row>
                                        ))}
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                            <div className="from_details mb-4">
                                <h4 className="mb-3 stay_sub_title">Contact details</h4>
                                <div className="guest_from">
                                    <Row>
                                        <Col sm={6} className="mb-4">
                                            <Form.Group>
                                                <Form.Label>Email</Form.Label>
                                                <Form.Control 
                                                    className={`rounded-3 ${validationErrors.email ? 'is-invalid' : ''}`} 
                                                    type="text" 
                                                    value={formData.email || ''} 
                                                    onChange={(e) => handleContactChange(e, 'email')}
                                                    placeholder="testmode@example.com" 
                                                />
                                                {validationErrors.email && (
                                                    <Form.Control.Feedback type="invalid">
                                                        {validationErrors.email}
                                                    </Form.Control.Feedback>
                                                )}
                                            </Form.Group>
                                        </Col>
                                        <Col sm={6} className="mb-4">
                                            <Form.Group>
                                                <Form.Label>Phone number</Form.Label>
                                                <Form.Control 
                                                    className={`rounded-3 ${validationErrors.phone_number ? 'is-invalid' : ''}`} 
                                                    type="text" 
                                                    value={formData.phone_number || ''} 
                                                    onChange={(e) => handleContactChange(e, 'phone_number')}
                                                    placeholder="+44 07242242424" 
                                                />
                                                {validationErrors.phone_number && (
                                                    <Form.Control.Feedback type="invalid">
                                                        {validationErrors.phone_number}
                                                    </Form.Control.Feedback>
                                                )}
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                            <div className="from_details mb-4">
                                <h4 className="mb-3 stay_sub_title">Additional information</h4>
                                <div className="guest_from">
                                    <Row>
                                        <Col lg={8}>
                                            <Row>
                                                <Col sm={12} className="mb-4">
                                                    <Form.Group>
                                                        <Form.Label>Special requests</Form.Label>
                                                        <Form.Control 
                                                            className="rounded-3" 
                                                            as="textarea" 
                                                            placeholder="Leave a comment here" 
                                                            style={{ height: '100px' }} 
                                                            value={formData.stay_special_requests || ''} 
                                                            onChange={handleSpecialRequestsChange}
                                                        />
                                                        <span className="mt-3 d-block">This field should not be used to provide medical or otherwise sensitive information.</span>
                                                    </Form.Group>
                                                </Col>
                                            </Row>
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                            {stayDetails?.data?.accommodation?.rooms?.[0]?.rates?.[0]?.cancellation_timeline ? (
                              stayDetails.data.accommodation.rooms[0].rates[0].cancellation_timeline.length > 0 ? (
                                // Refundable case with timeline
                                <div className="cancellation_policy mb-4">
                                  <h4 className="mb-3 stay_sub_title">Cancellation Policy</h4>
                                  <Card className="rounded-3">
                                    <Card.Body className="p-0">
                                      <ul className="policy_list">
                                        {stayDetails.data.accommodation.rooms[0].rates[0].cancellation_timeline.map((policy, index) => {
                                          const formattedDate = formatDateDisplay(policy.before);
                                          const isLast = index === stayDetails.data.accommodation.rooms[0].rates[0].cancellation_timeline.length - 1;
                                          const totalAmount = parseFloat(stayDetails.data.total_amount);
                                          const refundAmount = parseFloat(policy.refund_amount);
                                          const cancellationFee = (totalAmount - refundAmount).toFixed(2);
                                          
                                          return (
                                            <li className="list_item" key={`policy-${index}`}>
                                              <div className="check_icon">
                                                <i className={`ti ti-${isLast ? 'x close_i' : 'check check_i'}`}></i>
                                              </div>
                                              <p>
                                                <strong>{isLast ? 'No refund' : 'Refundable for a fee'}</strong>
                                                -- {isLast ? (
                                                  `From ${formattedDate.date}, ${formattedDate.time} onwards, you won't be able to get any refund for cancelling this booking.`
                                                ) : (
                                                  `If you cancel before ${formattedDate.date}, ${formattedDate.time}, you will receive a partial refund of ${stayDetails.data.total_currency}${policy.refund_amount}. A cancellation fee of ${stayDetails.data.total_currency}${cancellationFee} will be retained.`
                                                )}
                                              </p>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                      <div className="timeline-wrapper">
                                        <div className="timeline-bar">
                                          <div className="progress-line"></div>
                                        </div>
                                        <div className="timeline-points">
                                          <div className="point">
                                            <div className="top">
                                              <div className="date">Today</div>
                                              <div className="time">{format(new Date(), 'h:mm a')} local</div>
                                            </div>
                                            <div className="dot gray"></div>
                                            <div className="bottom">
                                              <div className="label">Booking</div>
                                            </div>
                                          </div>

                                          {stayDetails.data.accommodation.rooms[0].rates[0].cancellation_timeline.map((policy, index) => {
                                            const formattedDate = formatDateDisplay(policy.before);
                                            const isLast = index === stayDetails.data.accommodation.rooms[0].rates[0].cancellation_timeline.length - 1;
                                            
                                            return (
                                              <div className="point" key={`timeline-${index}`}>
                                                <div className="top">
                                                  <div className="date">{formattedDate.date}</div>
                                                  <div className="time">{formattedDate.time}</div>
                                                </div>
                                                <div className={`dot ${isLast ? 'red' : 'orange'}`}></div>
                                                <div className="bottom">
                                                  <div className="label">
                                                    {isLast ? 'No refund' : `Partial refund`}
                                                  </div>
                                                  {!isLast && (
                                                    <div className="amount">{stayDetails.data.total_currency}{policy.refund_amount}</div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}

                                          {stayDetails?.data?.check_in_date && (
                                            <div className="point">
                                              <div className="top">
                                                <div className="date">{formatDateDisplay(stayDetails.data.check_in_date).date}</div>
                                              </div>
                                              <div className="dot gray"></div>
                                              <div className="bottom">
                                                <div className="label">Check-in<br />at the hotel</div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </Card.Body>
                                  </Card>
                                </div>
                              ) : (
                                // Non-refundable case without timeline
                                <div className="cancellation_policy mb-4">
                                  <h4 className="mb-3 stay_sub_title">Cancellation Policy</h4>
                                  <Card className="rounded-3">
                                    <Card.Body>
                                      <ul className="policy_list">
                                        <li className="list_item">
                                          <div className="check_icon">
                                            <i className='ti ti-x close_i'></i>
                                          </div>
                                          <p>
                                            <strong>Non-refundable</strong>
                                            -- You have chosen a non-refundable rate. If you cancel this booking, you will not receive any refund.
                                          </p>
                                        </li>
                                      </ul>
                                    </Card.Body>
                                  </Card>
                                </div>
                              )
                            ) : null}
                        </Col>
                        <Col md={4}>
                            <div className="billing_summary">
                                <h4 className="mb-3 stay_sub_title">Billing summary</h4>
                                <Card className="border rounded-3">
                                    <Card.Body>
                                        <p className="mb-2"><strong>Pay now</strong></p>
                                        <table className="total_table table table-striped fs-6">
                                            <tbody>
                                              <tr>
                                                <td>Room(s)</td>
                                                <td align="right">{stayDetails?.data?.base_currency}{stayDetails?.data?.base_amount}</td>
                                              </tr>
                                              <tr>
                                                <td>Tax</td>
                                                <td align="right">{stayDetails?.data?.tax_currency}{stayDetails?.data?.tax_amount}</td>
                                              </tr>
                                              <tr>
                                                <td>Fees</td>
                                                <td align="right">{stayDetails?.data?.fee_currency}{stayDetails?.data?.fee_amount}</td>
                                              </tr>
                                              <tr>
                                                <td>Total</td>
                                                <td align="right">{stayDetails?.data?.total_currency}{stayDetails?.data?.total_amount}</td>
                                              </tr>
                                            </tbody>
                                        </table>
                                        <p className="mb-4">Payment method: {stayDetails?.data?.accommodation?.rooms?.[0]?.rates?.[0]?.available_payment_methods?.[0] || 'balance'}</p>
                                        {stayDetails?.data?.due_at_accommodation_amount && (
                                            <>
                                                <p className="mb-2"><strong>Pay at accommodation</strong></p>
                                                <table className="total_table table table-striped fs-6">
                                                    <tbody>
                                                      <tr>
                                                        <td>Accommodation fee</td>
                                                        <td align="right">{stayDetails?.data?.due_at_accommodation_currency}{stayDetails?.data?.due_at_accommodation_amount}</td>
                                                      </tr>
                                                    </tbody>
                                                </table>
                                            </>
                                        )}
                                    </Card.Body>
                                </Card>

                                <div className="billing_text">
                                    <p className="">
                                        By paying, you confirm you agree to Duffel's Terms and Conditions (available on the Duffel website) and the accommodation's  
                                        <Link className="test_link">conditions</Link>. To find out how Duffel uses your personal data, please see Duffel's Privacy Policy.
                                    </p>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>
            <section className="stay_details">
                <Container>
                    <Row className="align-items-center">
                        <Col md={6}>
                            <h4>{stayDetails?.data?.total_currency}{stayDetails?.data?.total_amount}</h4>
                            <p>
                                Total amount, including taxes for {countGuests().adults} adults, 
                                {countGuests().children > 0 ? ` ${countGuests().children} children` : ''} 
                                and {stayDetails?.data?.rooms}x Successful Booking
                            </p>
                        </Col>
                        <Col md={6} className="d-flex align-items-center justify-content-end">
                            <Button 
                                className="btn btn-primary" 
                                onClick={handlePayment}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : 'Pay with test balance'}
                            </Button>
                        </Col>
                    </Row>
                </Container>
            </section>
            {/* End Contact */}
        </>
    );
};

export default StayCart;