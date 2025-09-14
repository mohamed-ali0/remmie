import React from 'react';
import Breadcrumb from '../components/Breadcrumb';
import { Container, Row, Col } from 'react-bootstrap';
import { IconMail, IconMapPin } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import travel_img from '/src/assets/images/travel_img.png';
import travel_img2 from '/src/assets/images/travel_img2.png';
import travel_img3 from '/src/assets/images/travel_img3.png';


export default function About() {
  return (
    <>

        {/* Breadcrumb Start */}
        <Breadcrumb title="About"/>
        {/* Breadcrumb Start */}

        <section className='space-py-100'> 
            <Container>
                <Row className='align-items-center gy-4'>
                    <Col lg={6}>
                    <div className='img_wrap'>
                        <img src={travel_img} alt="" className='w-100 img-fluid'/>
                    </div>
                    </Col>
                    <Col lg={6}>
                        <h3 className='title pb-4'>Meet Remmie.ai: Your Travel Planning Partner</h3>
                        <p className='mb-0 pb-4'>At Remmie.ai, we’re your personal travel sidekick, powered by cutting-edge AI to make trip planning effortless and exciting. Whether it’s scoring the best flight deals, finding the perfect hotel, or crafting a dream itinerary, Remmie is here to take the stress out of travel. We believe every journey should be as fun to plan as it is to experience—and that’s exactly what we deliver, one chat at a time.</p>
                        <Link className='btn btn-primary get_remi_btn'>Get Started with Remmie</Link>
                    </Col>
                </Row>
            </Container>
            <Container className='mt-5'>
                <Row className='gy-4'>
                    <Col lg={4} md={6}>
                        <div className='contact_grid'>
                            <div className='icon_wrap bg_primary'>
                                <IconMapPin className='text-white'/>
                            </div>
                            <div className='contact_detail'>
                                <h4>Address</h4>
                                <p>Lorem ipsum dolor lorem</p>
                            </div>
                        </div>
                    </Col>
                    <Col lg={4} md={6}>
                        <div className='contact_grid'>
                            <div className='icon_wrap bg_primary'>
                                <IconMail className='text-white'/>
                            </div>
                            <div className='contact_detail'>
                                <h4>Email Address</h4>
                                <p>Lorem@gmail.com</p>                                                                              
                            </div>
                        </div>
                    </Col>
                    <Col lg={4} md={6}>
                        <div className='contact_grid'>
                            <div className='icon_wrap bg_primary'>
                            <IconMail className='text-white'/>
                            </div>
                            <div className='contact_detail'>
                                <h4>Email Address</h4>
                                <p>Link</p>
                            </div>
                        </div>
                    </Col>
                </Row>    
            </Container>
        </section>

        <section className='bg_light'>
          <Container className='space-py-100'>
            <Row className='align-items-center gy-4'>
              <Col lg={6}>
                  <h3 className='title pb-4'>Why We’re Here: Making Travel Simple and Fun</h3>
                  <p className='mb-0 pb-4'>Our mission is to simplify travel for everyone. We use smart AI to bring you fast, affordable, and personalized travel options, so you can focus on the adventure ahead. From budget-friendly flights to hidden gem destinations, Remmie.ai is dedicated to making your trip planning seamless, enjoyable, and tailored just for you.</p>
                  <Link className='btn btn-primary get_remi_btn'>Get Started with Remmie</Link>
              </Col>
              <Col lg={6}>
                <div className='img_wrap'>
                    <img src={travel_img2} alt="" className='w-100 img-fluid'/>
                </div>
              </Col>
            </Row>
          </Container>
        </section>


        <section className='space-py-100'>
            <Container>
            <Row className='align-items-center gy-4'>
                <Col lg={6}>
                <div className='img_wrap'>
                    <img src={travel_img3} alt="" className='w-100 img-fluid'/>
                </div>
                </Col>
                <Col lg={6}>
                    <h3 className='title pb-4'>Our Dream: Inspiring Your Next Adventure</h3>
                    <p className='mb-0 pb-4'>We envision a world where travel is accessible and inspiring for all. Remmie.ai aims to be the go-to travel companion, blending technology with a human touch to unlock unforgettable experiences. Our goal? To empower you to explore more, stress less, and create memories that last a lifetime—wherever your wanderlust takes you.</p>
                    <Link className='btn btn-primary get_remi_btn'>Get Started with Remmie</Link>
                </Col>
            </Row>
            </Container>
        </section>
      
    </>
  )
}
