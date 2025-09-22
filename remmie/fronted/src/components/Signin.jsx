import React, { useState, useEffect } from 'react';
import { Col, Container, Row, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom'; 
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import axios from 'axios';
import { loginSchema } from '../validationSchemas/validationSchema';
import logo from "/src/assets/images/logo.png";
import appleicon from "/src/assets/images/apple.svg";
import facebookicon from "/src/assets/images/facebook.svg";
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

export default function Signin() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const location = useLocation();

  // ✅ URLમાંથી contact_email લાવો
  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect') || '/';
  // 🔹 Extract contact_email from redirect param if exists
  let contactEmail = '';
  try {
    const decodedRedirect = decodeURIComponent(redirectParam); // decode %2F etc.
    const innerParams = new URLSearchParams(decodedRedirect.split('?')[1] || '');
    contactEmail = innerParams.get('contact_email') || '';
  } catch (e) {
    console.error("Error parsing redirect param", e);
  }
  // const contactEmail = searchParams.get('contact_email') || '';
  // console.log(contactEmail);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm({
    resolver: yupResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      email: contactEmail // ✅ email field prefill
    }
  });

  useEffect(() => {
    if (contactEmail) {
      setValue('email', contactEmail); // જો defaultValues માંથી ન આવે તો પણ set કરી દેશે
    }
  }, [contactEmail, setValue]);

  const from = searchParams.get('redirect') || '/';
  // const from = new URLSearchParams(location.search).get('redirect') || '/';
  // console.log(from);
  const onSubmit = async (data) => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/signin`, data);
      localStorage.setItem('token', res.data.token); // Save token
      localStorage.setItem('user_profile', res.data.user_profile);
      localStorage.setItem('first_name', res.data.first_name);
      localStorage.setItem('last_name', res.data.last_name);
      navigate(from); // Or your home page
    } catch (err) {
      setServerError(err.response?.data?.message || 'Invalid email or password');
    }
  };

  // ✅ Google login success handler

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const token = credentialResponse.credential; // Google ID token
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/signin-google`, { token });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user_profile',res.data.user_profile);
      localStorage.setItem('first_name', res.data.first_name);
      localStorage.setItem('last_name', res.data.last_name);
      navigate(from);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Google login failed');
    }
  };

  return (
    <section className='py-5'>
      <Container>
        <Row>
          <Col lg="5" md="7" className='mx-auto'>
            <div className='authentication'>
              <div>
                <div className='text-center mb-3'>
                  <Link to="/" className='brand-logo'>
                      <img src={logo} alt="" className='img-fluid' />
                      <span className='fs-4 align-middle ms-2 fw-semibold lh-1 text-dark'>Remmie.ai</span>
                  </Link>
                </div>
                <h2 className='mb-3'>Sign in or create an account</h2>
                <p className='mb-3'>Unlock a world of travel with one account across Expedia, Hotels.com, and Vrbo.</p>

                {serverError && <Alert variant="danger">{serverError}</Alert>}

                {/*<Link className='btn btn-primary w-100'>
                  Sign In With Google
                </Link>*/}
                 {/* ✅ Google Login Button */}

                <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setServerError('Google login failed')}
                    size="large"
                    shape="pill"
                    text="continue_with"
                  />
                </GoogleOAuthProvider>

                <p className='text-center my-3'>or</p>

                <Form onSubmit={handleSubmit(onSubmit)}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Email</Form.Label>
                    <Form.Control type="text" placeholder="Email" {...register('email')} />
                    <p className="text-danger">{errors.email?.message}</p>
                  </Form.Group>

                  <Form.Group className='mb-3'>
                    <Form.Label>Password</Form.Label>
                    <Form.Control type="password" placeholder="Password" {...register('password')} />
                    <p className="text-danger">{errors.password?.message}</p>
                  </Form.Group>

                  <Button className='btn btn-primary w-100 mt-4' type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                  </Button>
                </Form>

                <p className='text-center my-4'>
                  Other ways to 
                  {/* <Link to={'/sign-up'}> Sign Up</Link> */}
                  {/* <Link to={`/sign-up?redirect=${encodeURIComponent(from)}`}> Sign Up</Link> */}
                  <Link className="text-primary ms-2" to={from === '/' ? '/sign-up' : `/sign-up?redirect=${encodeURIComponent(from)}`}>
                      Sign Up
                    </Link>

                </p>                               

                <ul className='autg_list'>
                  <li>
                    <Link>
                      <img src={appleicon} alt="" className='img-fluid' />
                    </Link>
                  </li>
                  <li>
                    <Link>
                      <img src={facebookicon} alt="" className='img-fluid' />
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
}