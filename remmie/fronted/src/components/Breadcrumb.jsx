import React from 'react'
import { Container, Row, Col } from 'react-bootstrap'

export default function Breadcrumb(props) {
  return (
    <>
      <section className='breadcrumb'>
        <Container>
            <Row className='justify-content-center'>
                <Col xl={4}>
                    <h2>{props.title}</h2>
                </Col>
            </Row>
        </Container>
      </section>
    </>
  )
}
