import React from 'react'
// import travelasistance from '/src/assets/images/travelasistance.png';
import travelasistance from '/src/assets/images/travelassistant.jpeg';

import { Container,Row,Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function Travelassistant() {
  return (
    <>
      <section className='space-pb-100 travel_assistance'>
            <Container>
                <Row className='align-items-center'>
                    <Col md={6}>
                        <div className='img_wrap p-4 ps-0'>
                            <img src={travelasistance} alt="" className='img-fluid w-100'/>
                        </div>
                    </Col>
                    <Col md={6}>
                        <h2 className='title'>Discover the Joy of Seamless Travel with Remmie AI</h2>
                        <p className='mt-3'>Planning your dream vacation is easier than ever—let Remmie AI handle the details, from selecting the right tickets to organizing every aspect of your travel experience.</p>
                        <p className='mt-3 mb-2'>Let Remmie AI help you plan the perfect trip, finding the best tickets, the best deals, and the best experiences, all personalized just for you.</p>
                        <Link to="" className='btn btn-secondary mt-4'>Get Started with Remmie</Link>
                    </Col>
                </Row>
            </Container>
      </section>
    </>
  )
}
