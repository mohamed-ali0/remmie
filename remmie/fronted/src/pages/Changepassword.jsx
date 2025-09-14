import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import Userprofilesidebar from '../components/Userprofilesidebar';

const Changepassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Validate individual fields on blur
  const validateField = (name, value) => {
    let errorMsg = '';
    
    switch(name) {
      case 'currentPassword':
        if (!value.trim()) {
          errorMsg = 'Current password is required';
        }
        break;
      case 'newPassword':
        if (!value.trim()) {
          errorMsg = 'New password is required';
        } else if (value.length < 8) {
          errorMsg = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])/.test(value)) {
          errorMsg = 'Password must contain at least one lowercase letter';
        } else if (!/(?=.*[A-Z])/.test(value)) {
          errorMsg = 'Password must contain at least one uppercase letter';
        } else if (!/(?=.*\d)/.test(value)) {
          errorMsg = 'Password must contain at least one number';
        } else if (!/(?=.*[@$!%*?&])/.test(value)) {
          errorMsg = 'Password must contain at least one special character (@$!%*?&)';
        } else if (value === currentPassword) {
          errorMsg = 'New password must be different from current password';
        }
        break;
      case 'confirmPassword':
        if (!value.trim()) {
          errorMsg = 'Please confirm your password';
        } else if (value !== newPassword) {
          errorMsg = 'Passwords do not match';
        }
        break;
      default:
        break;
    }
    
    setValidationErrors(prev => ({
      ...prev,
      [name]: errorMsg
    }));
    
    return !errorMsg;
  };

  // Handle input blur events
  const handleBlur = (e) => {
    const { name, value } = e.target;
    validateField(name, value);
  };

  // Validate entire form
  const validateForm = () => {
    let isValid = true;
    const errors = {};
    
    if (!currentPassword.trim()) {
      errors.currentPassword = 'Current password is required';
      isValid = false;
    }
    
    if (!newPassword.trim()) {
      errors.newPassword = 'New password is required';
      isValid = false;
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
      isValid = false;
    } else if (!/(?=.*[a-z])/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one lowercase letter';
      isValid = false;
    } else if (!/(?=.*[A-Z])/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one uppercase letter';
      isValid = false;
    } else if (!/(?=.*\d)/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one number';
      isValid = false;
    } else if (!/(?=.*[@$!%*?&])/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one special character (@$!%*?&)';
      isValid = false;
    } else if (newPassword === currentPassword) {
      errors.newPassword = 'New password must be different from current password';
      isValid = false;
    }
    
    if (!confirmPassword.trim()) {
      errors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }
    
    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Token storage (localStorage/sessionStorage ma hoy to retrieve karo)
      const token = localStorage.getItem('token');

      const response = await axios.post(
        'https://remmie.co:5000/api/auth/change-password',
        {
          oldpassword: currentPassword,
          newpassword: newPassword,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      setSuccess(response.data.message || 'Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setValidationErrors({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-py-100">
      <Container>
        <Row className="justify-content-center">
          <Col md={9}>
            <Card className="mb-4">
              <Card.Body>
                <h3 className="mb-4">Change Password</h3>
                <Form onSubmit={handleSubmit}>
                  <Row className="gy-3">

                    {error && <Alert variant="danger">{error}</Alert>}
                    {success && <Alert variant="success">{success}</Alert>}

                    <Col md={12}>
                      <Form.Group controlId="currentPassword">
                        <Form.Label>Current Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Enter your current password"
                          name="currentPassword"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          onBlur={handleBlur}
                          isInvalid={!!validationErrors.currentPassword}
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.currentPassword}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>

                    <Col md={12}>
                      <Form.Group controlId="newPassword">
                        <Form.Label>New Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Enter your new password"
                          name="newPassword"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          onBlur={handleBlur}
                          isInvalid={!!validationErrors.newPassword}
                        />
                        <Form.Text className="text-muted">
                          Password must be at least 8 characters with uppercase, lowercase, number, and special character.
                        </Form.Text>
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.newPassword}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>

                    <Col md={12}>
                      <Form.Group controlId="confirmPassword">
                        <Form.Label>Confirm New Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Confirm your new password"
                          name="confirmPassword"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onBlur={handleBlur}
                          isInvalid={!!validationErrors.confirmPassword}
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.confirmPassword}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>

                    <Col md={12} className="text-end">
                      <Button type="submit" variant="primary" disabled={loading}>
                        {loading ? <Spinner size="sm" animation="border" /> : 'Update Password'}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Userprofilesidebar/>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Changepassword;