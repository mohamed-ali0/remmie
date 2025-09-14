import { IconCalendar, IconMapPin, IconUser } from '@tabler/icons-react'
import React from 'react'
import { Container,Row,Col, FormControl, FormLabel, InputGroup, Button } from 'react-bootstrap'
import InputGroupText from 'react-bootstrap/esm/InputGroupText'
import Flightresultgrid from '../components/Flightresultgrid'
import Filterbar from '../components/Filterbar'
import Travelplansassistance from '../components/Travelplansassistance'
export default function Flight() {
  return (
    <>
      <section className='space-pt-100 flight_search'>
        <Container>
            <Row>
                <Col xl={12}>
                    <div className='d-flex align-items-end gap-4 d-none'>
                        <div>
                            <FormLabel>Flyiing from</FormLabel>
                            <InputGroup>
                                <InputGroupText>
                                    <IconMapPin/>
                                </InputGroupText>
                                <FormControl placeholder=''/>
                            </InputGroup>
                        </div>
                        <div>
                            <FormLabel>Flyiing to</FormLabel>
                            <InputGroup>
                                <InputGroupText>                                   
                                    <IconCalendar/>
                                </InputGroupText>
                                <FormControl placeholder=''/>
                            </InputGroup>
                        </div>
                        <div>
                            <FormLabel>Departing</FormLabel>
                            <InputGroup>
                                <InputGroupText>
                                    <IconUser/>
                                </InputGroupText>
                                <FormControl placeholder=''/>
                            </InputGroup>
                        </div>
                        <div>
                            <FormLabel>Returning</FormLabel>
                            <InputGroup>
                                <InputGroupText>                                   
                                    <IconUser/>
                                </InputGroupText>
                                <FormControl placeholder=''/>
                            </InputGroup>
                        </div>
                        <div>
                            <Button variant='primary'>Search</Button>
                        </div>
                    </div>
                    <div className='mb-5'>
                        <h4 className='fw-bold text_primary mb-2'>Recommended Flights</h4>
                        <p className='text_light'>Here’s what I found for flights to Vietnam! Tell me your departure city and dates to narrow it down, or check out these options to get started.</p>
                    </div>
                </Col>
            </Row>
        </Container>
      </section>

      <section className='space-pb-100'>
            <Container>
                <Row>
                    <Col xl={8}>
                        <Row className='gy-4'>
                            <Col xl={12}>
                                <Flightresultgrid/>
                            </Col>
                            <Col xl={12}>
                                <Flightresultgrid/>
                            </Col>
                            <Col xl={12}>
                                <Flightresultgrid/>
                            </Col>
                            <Col xl={12}>
                                <Flightresultgrid/>
                            </Col>
                            <Col xl={12}>
                                <Flightresultgrid/>
                            </Col>
                            <Col xl={12}>
                                <Flightresultgrid/>
                            </Col>
                        </Row>
                    </Col>
                    <Col xl={4}>
                        <Row className='gy-4'>
                            <Filterbar/>
                        </Row>
                    </Col>
                </Row>
            </Container>
      </section>


      <section>
        <Container>
            <Row>
                <Col xl={12}>
                    <Travelplansassistance/>
                </Col>
            </Row>
        </Container>
      </section>
    </>
  )
}
