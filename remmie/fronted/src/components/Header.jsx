import React, { useState, useEffect } from 'react';
import { Row, Col, Container, Form, InputGroup, Dropdown } from 'react-bootstrap';
import { Link, useNavigate } from "react-router-dom";
import { IconMenuDeep, IconX } from '@tabler/icons-react';
import { handleAuthCheck  } from '../utils/auth';
import logo from '/src/assets/images/logo.png';
import iconsearch from '/src/assets/images/icon/search.png';
import navprofile from '/src/assets/images/navprofile.png';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profileImage, setProfileImage] = useState(navprofile); 

  const toggleNav = () => {
    setIsOpen(!isOpen);
  };

  const navigate = useNavigate();
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  // useEffect(() => {
  //   const token = localStorage.getItem('token');
  //   setIsLoggedIn(!!token);
  // }, []);
  useEffect(() => {
    handleAuthCheck(navigate, setIsLoggedIn, setProfileImage);
  }, []);

   
  // const handleLogout = (e) => {
  //   e.preventDefault();
  //   localStorage.removeItem('token');
  //   setIsLoggedIn(false);
  //   navigate('/');
  // };
   const handleLogout = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
      if (token) {
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/signout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }

      // Clear token from local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user_profile');
      setIsLoggedIn(false);
      navigate('/');

    } catch (error) {
      console.error("Logout failed:", error);
      // Still clear token and redirect
      localStorage.removeItem('token');
      localStorage.removeItem('user_profile');
      setIsLoggedIn(false);
      navigate('/');
    }
  };

return (
    <>
      <header className='header'>
        <Container>
          <Row className='align-items-center'>
            <Col lg={3} xs={6}>
              <Link to="/" className='brand-logo'>
                <img src={logo} alt="" className='img-fluid' />
                <span className='fs-4 align-middle ms-2 fw-semibold lh-1 text-dark'>Remmie.ai</span>
              </Link>
            </Col>
            <Col lg={9} xs={6}>
              <div className='d-flex align-items-center justify-content-end'>
                {/*<div className={`menu_layear ${isOpen ? 'active' : ''}`}></div>*/}
                <div className={`nav_collapse ${isOpen ? 'active' : ''}`}>
                  <div className="d-xl-none close_menu">
                    <div className="d-flex align-items-center justify-content-between">
                      <img src={logo} alt="" className='img-fluid' />
                      <span onClick={toggleNav}>
                        <IconX />
                      </span>
                    </div>                                  
                  </div>
                  <ul className='menu_list'>
                    <li><Link to="/">Home</Link></li>
                    <li><Link to="/about">About Us</Link></li>
                    <li><Link to="/faq">FAQs</Link></li>
                    <li><Link to="/flightorderhistory">Booking</Link></li>
                  </ul>                
                </div>
                <div className='nav_user d-flex align-items-center gap-2 ms-4'>
                        {/*<Link to="" className="btn btn-primary">Get Started with Remmie</Link>*/}
                        <div className="d-flex align-items-center">
                          {isLoggedIn ? (
                                <Dropdown className="usr_profile">
                                  <Dropdown.Toggle id="dropdown-basic" className="action_dropdown">
                                    <img src={profileImage} alt="" />
                                  </Dropdown.Toggle>

                                  <Dropdown.Menu>
                                    <Dropdown.Item>
                                      <Link to="/userprofile">User Profile</Link>
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={handleLogout}>Logout</Dropdown.Item>
                                  </Dropdown.Menu>
                                </Dropdown>    
                                
                              ) : (
                                <Link to="/sign-in" className="btn btn-primary">Login</Link>
                              )}
                        </div>
                    </div>
                <div className='menu_action d-xl-none ms-2' onClick={toggleNav}>
                  <IconMenuDeep />
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </header>
    </>
  );
}
