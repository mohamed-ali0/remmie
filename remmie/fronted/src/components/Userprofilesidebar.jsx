import React from 'react';
import { Col, Container, Row, Form, Button, Alert, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { IconChevronRight } from '@tabler/icons-react';

export default function Userprofilesidebar() {
  return (
    <>
      <Card className='p-3 mb-3'>
        <Card.Header className='px-0 bg-transparent d-flex justify-content-between align-items-center'>
          <h6 className="w-100"><Link to={'/userprofile'} className="d-flex justify-content-between align-items-center">User Profile <IconChevronRight /></Link></h6>
        </Card.Header>
        <Card.Body className='px-0 pt-3 pb-2'>
          <h5 className='text-secondary fs-6'>View personal details</h5>
        </Card.Body>
      </Card>

      <Card className='p-3 mb-3'>
        <Card.Header className='px-0 bg-transparent d-flex justify-content-between align-items-center'>
          <h6 className="w-100"><Link to={''} className="d-flex justify-content-between align-items-center">Order History</Link></h6>
          {/*<Link ><IconChevronRight /></Link>*/}
        </Card.Header>
        <Card.Body className='px-0 pt-3 pb-2'>
          <p className='text-secondary fs-6 pb-2'>
            <Link className="d-flex justify-content-between align-items-center" to={'/flightorderhistory'}>Flight Order History <IconChevronRight /></Link>
          </p>
          <p className='text-secondary fs-6'>
            <Link className="d-flex justify-content-between align-items-center" to={'/staysorderhistory'}>Stays Order History <IconChevronRight /></Link>
          </p>
        </Card.Body>
      </Card>

      <Card className='p-3 mb-3'>
        <Card.Header className='px-0 bg-transparent d-flex justify-content-between align-items-center'>
          <h6 className="w-100"><Link to={'/payment-mathod'} className="d-flex justify-content-between align-items-center">Payment Methods<IconChevronRight /></Link></h6>
        </Card.Header>
        <Card.Body className='px-0 pt-3 pb-2'>
          <h5 className='text-secondary fs-6'>View saved payment methods</h5>
        </Card.Body>
      </Card>

      <Card className='p-3 mb-3'>
        <Card.Header className='px-0 bg-transparent d-flex justify-content-between align-items-center'>
          <h6 className="w-100"><Link to={'/change-password'} className="d-flex justify-content-between align-items-center" >Security & Settings<IconChevronRight /></Link></h6>
        </Card.Header>
        <Card.Body className='px-0 pt-3 pb-2'>
          <h5 className='text-secondary fs-6'>Update your email or password</h5>
        </Card.Body>
      </Card>

      <Card className='p-3 mb-3'>
        <Card.Header className='px-0 bg-transparent d-flex justify-content-between align-items-center'>
          <h6 className="w-100"><Link to={'/help'} className="d-flex justify-content-between align-items-center">Help & Feedback<IconChevronRight /></Link></h6>
        </Card.Header>
        <Card.Body className='px-0 pt-3 pb-2'>
          <h5 className='text-secondary fs-6'>Get customer support</h5>
        </Card.Body>
      </Card>
    </>
  );
}
