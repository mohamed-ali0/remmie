import React from 'react'
import Breadcrumb from '../components/Breadcrumb'
import { Card, CardBody, Col, Container, Row,Form, Button } from 'react-bootstrap'
import { IconMail, IconMapPin } from '@tabler/icons-react'
export default function Contact() {
  return (
    <>

        {/* Breadcrumb Start */}
        <Breadcrumb title="Contact Us"/>
        {/* Breadcrumb Start */}

        {/* Start Contact */}
        <section className='contact_us space-py-100'>
            <Container>
                <Row className='gy-4'>
                    <Col lg={4}>
                        <h2 class="title title_second mb-4">Contact Information</h2>
                        <p className='mb-4'>California Contractors LicenseC-27 # 991368</p>
                        <Row className='gy-4'>
                            <Col xl={12}>
                                <div className='contact_grid'>
                                    <div className='icon_wrap bg_secondary'>
                                        <IconMapPin className='text-white'/>
                                    </div>
                                    <div className='contact_detail'>
                                        <h4>Address</h4>
                                        <p>Lorem ipsum dolor lorem</p>
                                    </div>
                                </div>
                            </Col>
                            <Col xl={12}>
                                <div className='contact_grid'>
                                    <div className='icon_wrap bg_secondary'>
                                        <IconMail className='text-white'/>
                                    </div>
                                    <div className='contact_detail'>
                                        <h4>Email Address</h4>
                                        <p>Lorem@gmail.com</p>                                                                              
                                    </div>
                                </div>
                            </Col>
                            <Col xl={12}>
                                <div className='contact_grid'>
                                    <div className='icon_wrap bg_secondary'>
                                    <IconMail className='text-white'/>
                                    </div>
                                    <div className='contact_detail'>
                                        <h4>Email Address</h4>
                                        <p>Link</p>
                                    </div>
                                </div>
                            </Col>
                        </Row>                       
                    </Col>
                    <Col lg={8}>
                        <Card>
                            <CardBody>
                                <Row className='gy-4'>
                                    <Col xl={12}>
                                        <Form.Control placeholder="Full Name"/>
                                    </Col>
                                    <Col xl={12}>
                                        <Form.Control placeholder="Email Address"/>
                                    </Col>
                                    <Col xl={12}>
                                        <Form.Control as="textarea" rows={17} placeholder="Message"/>
                                    </Col>
                                    <Col xl={12}>
                                        <Button variant='primary' className='px-5'>Submit</Button>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </section>
        {/* End Contact */}
    </>
  )
}
