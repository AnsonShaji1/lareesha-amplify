import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

interface FAQItem {
  question: string;
  answer: string;
  isOpen: boolean;
}

@Component({
  selector: 'app-help-support-page',
  imports: [CommonModule, MatIconModule],
  templateUrl: './help-support-page.html',
  styleUrl: './help-support-page.scss',
})
export class HelpSupportPage {
  faqs: FAQItem[] = [
    {
      question: 'How do I track my order?',
      answer:
        'You can track your order by clicking on "Track Order" in your account menu or by visiting the Orders page. Enter your order number to get the latest status updates.',
      isOpen: false,
    },
    {
      question: 'What is your return policy?',
      answer:
        'We do not offer returns or refunds for products once they have been delivered. However, if you receive a damaged or defective item, you may request a replacement by contacting us within 24 hours of delivery.',
      isOpen: false,
    },
    {
      question: 'How long does shipping take?',
      answer:
        'We dispatch orders through DTDC and India Post, depending on your location and service availability. Most orders are delivered within 3–7 business days after dispatch. Delivery times may vary for remote locations, public holidays, or unforeseen circumstances. Once your order has been shipped, you will receive a tracking number to track your shipment.',
      isOpen: false,
    },
    {
      question: 'Do you ship internationally?',
      answer:
        "International shipping is not available through our website at this time. If you would like to place an international order, please contact our team via WhatsApp or Instagram. We'll be happy to assist you with the available shipping options and order process.",
      isOpen: false,
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept all major credit cards, debit cards, UPI, net banking, and digital wallets through our secure payment gateway powered by Razorpay.',
      isOpen: false,
    },
    {
      question: 'How do I contact customer support?',
      answer:
        "Our support team is here to help! You can contact us via WhatsApp, Instagram, email at kichupoulose@gmail.com, or call us at +91 7736335483 (Monday–Saturday, 9:00 AM – 6:00 PM IST). We aim to respond to all inquiries as quickly as possible, typically within 24 hours.",
      isOpen: false,
    },
    {
      question: 'Are the product images accurate?',
      answer:
        "We strive to display accurate product images and colors. However, actual colors may vary slightly due to screen settings. If you're not satisfied, we offer easy returns.",
      isOpen: false,
    },
  ];

  toggleFAQ(index: number) {
    this.faqs[index].isOpen = !this.faqs[index].isOpen;
  }
}
