import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import axios from 'axios';
import { signupSchema } from '../validationSchemas/validationSchema';
import { Container, Row, Col, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import logo from '/src/assets/images/logo.png';

export default function Signup() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const location = useLocation();

  // 🔹 Get query params
  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect') || '/';

  // 🔹 Try to get email from direct query or nested redirect param
  let contactEmail = searchParams.get('contact_email') || '';
  if (!contactEmail && redirectParam) {
    try {
      const decodedRedirect = decodeURIComponent(redirectParam);
      const innerParams = new URLSearchParams(decodedRedirect.split('?')[1] || '');
      contactEmail = innerParams.get('contact_email') || '';
    } catch (e) {
      console.error("Error parsing redirect param", e);
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue
  } = useForm({
    resolver: yupResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: {
      email: contactEmail // ✅ prefill email
    }
  });

  // In case defaultValues missed, set explicitly
  useEffect(() => {
    if (contactEmail) {
      setValue('email', contactEmail);
    }
  }, [contactEmail, setValue]);

  const from = redirectParam || '/';
  
  //const from = new URLSearchParams(location.search).get('redirect') || '/';
  const onSubmit = async (data) => {
    try {
      // ✅ Step: Check email exists
      // const checkRes = await axios.post('${import.meta.env.VITE_API_URL}/api/auth/check-email', { email: data.email });
      // if (checkRes.data.exists) {
      //   setServerError('Email already registered');
      //   return;
      // }

      // ✅ Step: Proceed with signup
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/signup`, data);
      if (res.data.message == "User registered successfully") {
        // Proceed to login the user automatically
        const loginRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/signin`, {
          email: data.email,
          password: data.password,
        });

        // Save the token in localStorage (or sessionStorage) to keep the user logged in
        localStorage.setItem('token', loginRes.data.token);
        localStorage.setItem('user_profile', loginRes.data.user_profile);
        localStorage.setItem('first_name', loginRes.data.first_name);
        localStorage.setItem('last_name', loginRes.data.last_name);

        // Redirect to the homepage (or any protected page like a dashboard)
        setSuccessMessage("Signup successful! Logging you in...");
        setTimeout(() => navigate(from), 2000);  // You can replace '/' with any path you'd like
        
      } else {
        setServerError(res.data.message);
      }

    } catch (err) {
      setServerError(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <section className="py-5">
      <Container>
        <Row>
          <Col lg="5" md="7" className="mx-auto">
            <div className="authentication">
              <div className="text-center mb-3">
                <Link to="/" className='brand-logo'>
                    <img src={logo} alt="" className='img-fluid' />
                    <span className='fs-4 align-middle ms-2 fw-semibold lh-1 text-dark'>Remmie.ai</span>
                </Link>
              </div>

              {serverError && <Alert variant="danger">{serverError}</Alert>}
              {successMessage && <Alert variant="success">{successMessage}</Alert>}

              <Form onSubmit={handleSubmit(onSubmit)}>
                <Form.Group className="mb-3">
                  <Form.Label>First Name</Form.Label>
                  <Form.Control {...register('first_name')} placeholder="First Name" />
                  <p className="text-danger">{errors.first_name?.message}</p>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Last Name</Form.Label>
                  <Form.Control {...register('last_name')} placeholder="Last Name" />
                  <p className="text-danger">{errors.last_name?.message}</p>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Mobile</Form.Label>
                  <Form.Control {...register('mobile')} placeholder="Mobile Number" />
                  <p className="text-danger">{errors.mobile?.message}</p>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control {...register('email')} placeholder="Email" />
                  <p className="text-danger">{errors.email?.message}</p>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control type="password" {...register('password')} placeholder="Password" />
                  <p className="text-danger">{errors.password?.message}</p>
                </Form.Group>

                <Button className="btn btn-primary w-100 mt-4" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing Up...' : 'Sign Up'}
                </Button>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
}
