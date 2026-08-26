import React from 'react';
import RequestHistory from './RequestHistory';

const MyRequests = ({ authUser }) => {
  return (
    <div>
      <RequestHistory authUser={authUser} title="My Workflow Requests & Actioned History" />
    </div>
  );
};

export default MyRequests;
