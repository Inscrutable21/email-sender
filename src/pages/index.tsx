// src/pages/index.tsx
import type { NextPage } from 'next';
import EmailCampaignManager from '../components/EmailCampaignManager';

const Home: NextPage = () => {
  return <EmailCampaignManager />;
};

export default Home;