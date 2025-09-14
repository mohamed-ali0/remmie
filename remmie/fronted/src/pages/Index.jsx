import React from 'react'
import Herosection from '../components/Herosection'
import Tolkinstently from '../components/Tolkinstently'
import Travelassistant from '../components/Travelassistant'
import Faq from '../components/Faq'
import { Col, Container, Row } from 'react-bootstrap'

export default function Index() {
  return (
    <>
    
        {/* Start Hero section */}
        <Herosection/>
        {/* End Hero section */}

        {/* Start Tolk Instently */}
        <Tolkinstently/>
        {/* End Tolk Instently */}

        {/* Start Travel Assistance */}
        <Travelassistant/>
        {/* End Travel Assistance */}

        {/* Start Faq */}
        <section className='space-py-100 bg-light'>
            <Container>
                <Row className='justify-content-center'>
                    <Col xl={10}>
                        <h2 className='title text-center mb-4'>Frequently asked Questions</h2>
                        <Faq/>
                    </Col>
                </Row>
            </Container>
        </section>
        {/* End Faq */}

    </>
  )
}
