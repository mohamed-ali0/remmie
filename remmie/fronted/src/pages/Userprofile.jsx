import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, FormGroup, FormLabel, FormControl, Button } from 'react-bootstrap';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import { IconChevronRight } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom'; 
import user_img from '/src/assets/images/user_img.png';
import { getToken,checkAndLogoutIfExpired } from '../utils/auth';
import Userprofilesidebar from '../components/Userprofilesidebar';

export default function Userprofile() {
  const navigate = useNavigate();
  //  // DropZon Start 
  // const [searchInpval, setsearchInpval] = useState({
  //     uploadfiles: '',
  // });
  // const handleChange = (e) => {
  //     const { name, value } = e.target;
  //     setsearchInpval({ ...searchInpval, [name]: value, });

  // };
  // // File Upload    
  // const { getRootProps, getInputProps } = useDropzone({
  //     onDrop: (acceptedFiles) => {
  //         // Handle files   
  //     },
  // });

  // start new 18-07-2025
  const [userInfo, setUserInfo] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    // password: '',
    profile_image: '',
  });

  // ✅ Fetch user info on mount
  useEffect(() => {
    if (checkAndLogoutIfExpired(navigate)) return;
    const token = getToken();
    axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/user-info`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setUserInfo(res.data.data);
    }).catch(err => {
      console.error('Fetch User Info Error', err);
    });
  }, []);

  // ✅ Dropzone for image upload
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setUserInfo({ ...userInfo, profile_image: file });
      }
    },
  });

  // ✅ Handle form input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo({ ...userInfo, [name]: value });
  };

  // ✅ Submit updated profile
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (checkAndLogoutIfExpired(navigate)) return;

    const token = getToken();
    const formData = new FormData();
    formData.append('first_name', userInfo.first_name);
    formData.append('last_name', userInfo.last_name);
    formData.append('mobile', userInfo.mobile);
    // if (userInfo.password) formData.append('password', userInfo.password);
    if (userInfo.profile_image instanceof File) formData.append('profile_image', userInfo.profile_image);

    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/user-info-update`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Profile updated successfully');
    } catch (err) {
      console.error('Profile Update Error', err);
      alert('Error updating profile');
    }
  };
  return (
    <>
    <section className='space-py-100'>
      <Container>
        <Row>
          <Col md={9}>
            <Card className='p-3'>
              <Card.Header className="bg-transparent mb-3">
                <h6>User Profile</h6>
              </Card.Header>

               <Form onSubmit={handleSubmit}>
                <FormGroup className='mb-3'>
                  {/*<FormLabel>User Profile</FormLabel>*/}
                  <div {...getRootProps()} className="dropzone text-center">
                    <input {...getInputProps()} />
                    <div className="dz-default dz-message">
                      <div className="upload-icon">
                        <img
                          src={
                            userInfo.profile_image instanceof File
                              ? URL.createObjectURL(userInfo.profile_image)
                              : userInfo.profile_image || user_img
                          }
                          alt=""
                          className='img-fluid'
                        />
                      </div>
                    </div>
                  </div>
                </FormGroup>

                <FormGroup className='mb-3'>
                  <FormLabel>Name</FormLabel>
                  <FormControl name="first_name" value={userInfo.first_name} onChange={handleChange} />
                </FormGroup>

                <FormGroup className='mb-3'>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl name="last_name" value={userInfo.last_name} onChange={handleChange} />
                </FormGroup>

                <FormGroup className='mb-3'>
                  <FormLabel>Email</FormLabel>
                  <FormControl name="email" value={userInfo.email} disabled />
                </FormGroup>

                <FormGroup className='mb-3'>
                  <FormLabel>Contact Number</FormLabel>
                  <FormControl name="mobile" value={userInfo.mobile} onChange={handleChange} />
                </FormGroup>

                {/*<FormGroup className='mb-3'>
                  <FormLabel>Password</FormLabel>
                  <FormControl type="password" name="password" value={userInfo.password} onChange={handleChange} />
                </FormGroup>*/}

                <Button type="submit" className='btn btn-primary mt-3'>Update Profile</Button>
              </Form>
            </Card>
          </Col>
          <Col md={3}>
            <Userprofilesidebar/>
          </Col>
        </Row>
      </Container>
    </section>
    </>
  )
}
