import React from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import Breadcrumb from '../components/Breadcrumb'
import Faq from '../components/Faq'

export default function Faqpage() {
  return (
    <>
    
        {/* Breadcrumb Start */}
        <Breadcrumb title="Frequently Asked Questions"/>
        {/* Breadcrumb Start */}


        {/* Start Faq */}
        <section className='py-5 bg-light'>           
            <Container>
                <Row className='justify-content-center'>
                    <Col xl={10}>
                    <Faq/>
                    </Col>
                </Row>
            </Container>
        </section>
        {/* End Faq */}

    </>
  )
}
