// utils/upload.js

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

dotenv.config()

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

export const uploadToS3 = async (imageBase64, filename) => {
  try {
    const buffer = Buffer.from(imageBase64, 'base64')
    
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: `designs/${filename}`,
      Body: buffer,
      ContentType: 'image/png',
      ACL: 'public-read'
    })
    
    await s3Client.send(command)
    
    const url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/designs/${filename}`
    
    return url
    
  } catch (error) {
    console.error('S3 upload error:', error)
    throw error
  }
}