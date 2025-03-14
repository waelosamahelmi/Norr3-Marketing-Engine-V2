import sgMail from '@sendgrid/mail';
import { Campaign } from '../types';

// Initialize SendGrid with API key
const sendgridApiKey = import.meta.env.VITE_SENDGRID_API_KEY;
const senderEmail = import.meta.env.VITE_SENDER_EMAIL || 'no-reply@helmies.fi';
const slackEmail = import.meta.env.VITE_SLACK_EMAIL || 'norr3_marketing_engin-aaaapp5iy6c2cnov4tgc2yto6i@norr3.slack.com';

console.log('SendGrid API Key:', sendgridApiKey ? 'Configured' : 'Not configured');
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
} else {
  console.warn('SendGrid API key is not configured. Email notifications will not be sent.');
}

export const sendSlackNotification = async (
  action: 'created' | 'updated',
  campaignDetails: Campaign,
  userEmail: string
): Promise<boolean> => {
  try {
    if (!sendgridApiKey) {
      console.warn('SendGrid API key not configured. Skipping notification.');
      return false;
    }

    // Normalize channel values
    const channelMeta = campaignDetails.channel_meta === true || campaignDetails.channel_meta === 1;
    const channelDisplay = campaignDetails.channel_display === true || campaignDetails.channel_display === 1;
    const channelPdooh = campaignDetails.channel_pdooh === true || campaignDetails.channel_pdooh === 1;

    const channelsString = [
      channelMeta ? 'Meta' : '',
      channelDisplay ? 'Display' : '',
      channelPdooh ? 'PDOOH' : ''
    ].filter(Boolean).join(', ');

    const budgetTotal = (
      (parseFloat(campaignDetails.budget_meta as any) || 0) +
      (parseFloat(campaignDetails.budget_display as any) || 0) +
      (parseFloat(campaignDetails.budget_pdooh as any) || 0)
    ).toFixed(2);

    const locationString =
      campaignDetails.formatted_address ||
      `${campaignDetails.campaign_address}, ${campaignDetails.campaign_postal_code} ${campaignDetails.campaign_city}`;

    const subject = `Marketing Engine: Campaign ${action} by ${userEmail}`;
    
    let message = `*Campaign was ${action} by ${userEmail}*\n\n`;
    message += `*Campaign ID:* ${campaignDetails.id || 'N/A'}\n`;
    message += `*Partner:* ${campaignDetails.partner_name || 'Unknown'}\n`;
    message += `*Agent:* ${campaignDetails.agent || 'Unknown'}\n`;
    message += `*Agent Key:* ${campaignDetails.agent_key || 'N/A'}\n`;
    message += `*Location:* ${locationString || 'Not specified'}\n`;
    message += `*Radius:* ${campaignDetails.campaign_radius || 0}m\n`;
    message += `*Channels:* ${channelsString || 'None'}\n`;
    message += `*Total Budget:* €${budgetTotal}\n`;
    message += `*Start Date:* ${campaignDetails.campaign_start_date || 'Not set'}\n`;
    message += `*End Date:* ${campaignDetails.campaign_end_date || 'Ongoing'}\n`;
    message += `*Status:* ${campaignDetails.active ? 'Active' : 'Paused'}\n`;

    const msg = {
      to: slackEmail,
      from: senderEmail,
      subject: subject,
      text: message,
    };

    console.log('Sending notification to Slack via SendGrid:', msg);
    await sgMail.send(msg);
    console.log('Notification sent successfully');
    
    return true;
  } catch (error: any) {
    console.error('Error sending notification:', {
      message: error.message || 'Unknown error',
      stack: error.stack,
      response: error.response ? { ...error.response.body } : null,
    });
    
    if (error.response) {
      console.error('SendGrid API error details:', error.response.body);
    }
    
    return false;
  }
};