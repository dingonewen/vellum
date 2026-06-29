import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactElement } from "react";
import type { SummaryResult } from "../../summarizer/types";

interface DigestEmailProps {
  summary: SummaryResult;
}

export function DigestEmail({ summary }: DigestEmailProps): ReactElement {
  const generatedAt = new Date(summary.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Html>
      <Head />
      <Preview>{summary.subject}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={masthead}>
            <Heading style={brand}>Vellum</Heading>
            <Text style={eyebrow}>Inbox Digest</Text>
          </Section>
          <Section style={content}>
            <div dangerouslySetInnerHTML={{ __html: summary.htmlBody }} />
          </Section>
          <Text style={footer}>Generated {generatedAt}. PDF copy attached for your records.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  margin: "0",
  padding: "24px",
  backgroundColor: "#F5EFE4",
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const container = {
  maxWidth: "680px",
  margin: "0 auto",
  backgroundColor: "#FFFDF7",
  border: "1px solid #E8DCC8",
};

const masthead = {
  padding: "26px 32px",
  backgroundColor: "#4A2C17",
  borderBottom: "3px solid #C4A35A",
};

const brand = {
  margin: "0",
  color: "#F5EFE4",
  fontSize: "24px",
  lineHeight: "1.2",
  fontWeight: "700",
};

const eyebrow = {
  margin: "6px 0 0",
  color: "#C4A35A",
  fontSize: "12px",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
};

const content = {
  padding: "0",
};

const footer = {
  margin: "0",
  padding: "18px 32px 24px",
  color: "#8B7355",
  fontSize: "12px",
  lineHeight: "1.5",
  textAlign: "center" as const,
  fontStyle: "italic",
};
