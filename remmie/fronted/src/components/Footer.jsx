import React from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import logo from '/src/assets/images/logo.png';
import iconfb from '/src/assets/images/icon/icon_facebook.png';
import icontwt from '/src/assets/images/icon/icon_twiter.png';
import iconyoutube from '/src/assets/images/icon/icon_youtube.png';

export default function Footer() {
  return (
    <>
    <footer className='footer'>
        <Container>
            <Row className='gy-5'>
                <Col xl={8} md={6}>
                    <div className='footer_grid'>
                        <Link to="/" className='brand-logo'>
                            <img src={logo} alt="" className='img-fluid' />
                            <span className='fs-4 align-middle ms-2 fw-semibold lh-1 text-white'>Remmie.ai</span>
                        </Link>
                        <p className='text-white my-4'>Plan and book our perfect trip with expert advice, travel tips, destination <br /> information and  inspiration from us</p>
                        <ul className='social_list gap-4 d-flex'>
                            <li>
                                <Link>
                                    <img src={iconfb} alt=""  className='img-fluid'/>
                                </Link>
                            </li>
                            <li>
                                <Link>
                                    <img src={icontwt} alt=""  className='img-fluid'/>
                                </Link>
                            </li>
                            <li>
                                <Link>
                                    <img src={iconyoutube} alt=""  className='img-fluid'/>
                                </Link>
                            </li>
                        </ul>
                    </div>
                </Col>
                <Col xl={2} md={3}>
                    <div className='footer_grid'>
                        <h4 className='footer_title'>Navigation</h4>
                        <ul className='footer_list'>
                            <li>
                                <Link to="/">Home</Link>
                            </li>
                            <li>
                                <Link to="/about">About</Link>
                            </li>
                            <li>
                                <Link to="">Deals</Link>
                            </li>
                            <li>
                                <Link to="">Booking</Link>
                            </li>
                            <li>
                                <Link to="/contact">Contact</Link>
                            </li>
                        </ul>
                    </div>
                </Col>
                <Col xl={2} md={3}>
                    <div className='footer_grid'>
                        <h4 className='footer_title'>QUICK LINKS</h4>
                        <ul className='footer_list'>
                            <li>
                                <Link to="">Terms & Conditions</Link>
                            </li>
                            <li>
                                <Link to="">Privacy Policy</Link>
                            </li>
                            <li>
                                <Link to="/faq">FAQ</Link>
                            </li>                            
                        </ul>
                    </div>
                </Col>
                
            </Row>
            <Row>
                <Col md={12}>
                    <div className='sub_footer'>
                        <p>Copyright © 2025. All Rights Reserved</p>
                    </div>
                </Col>
            </Row>
        </Container>
    </footer>   
    </>
  )
}
