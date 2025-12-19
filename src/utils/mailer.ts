import nodemailer from "nodemailer";
import { env } from "../env.ts";
console.log("SMTP CHECK", {
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  user: env.SMTP_USER,
  pass: env.SMTP_PASS ? "SET" : "MISSING",
  from: env.SMTP_FROM,
});

let transporter: nodemailer.Transporter | undefined;

function getTransporter() {
  console.log("getTransporter called", {
    hasTransporter: Boolean(transporter),
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS ? "SET" : "MISSING",
  });
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("SMTP is not configured");
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendEmailVerificationCode(to: string, code: string) {
  const t = getTransporter();
  const from = env.SMTP_FROM || env.SMTP_USER;

  await t.sendMail({
    from,
    to,
    subject: "Your Uni+ verification code",
    text: `Your verification code is ${code}. It expires in ${env.EMAIL_OTP_TTL_SECONDS} seconds.`,
  });
}
