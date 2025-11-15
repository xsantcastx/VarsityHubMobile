// @ts-ignore - swagger-jsdoc doesn't have proper types
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VarsityHub API',
      version: '1.0.0',
      description: 'Sports social platform API for teams, games, posts, messaging, and event management',
      contact: {
        name: 'VarsityHub Support',
        email: 'support@varsityhub.com',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? 'https://api-production-8ac3.up.railway.app'
          : 'http://localhost:4000',
        description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token in Authorization header',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'cuid' },
            email: { type: 'string', format: 'email' },
            display_name: { type: 'string' },
            username: { type: 'string' },
            avatar_url: { type: 'string', format: 'uri' },
            bio: { type: 'string' },
            email_verified: { type: 'boolean' },
            banned: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            subscription_tier: { type: 'string', enum: ['free', 'premium', 'pro'] },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
            needs_onboarding: { type: 'boolean' },
            needs_verification: { type: 'boolean' },
          },
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            media_url: { type: 'string', format: 'uri' },
            author_id: { type: 'string' },
            game_id: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            upvote_count: { type: 'integer' },
            comment_count: { type: 'integer' },
          },
        },
        Game: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            date: { type: 'string', format: 'date-time' },
            location: { type: 'string' },
            home_team: { type: 'string' },
            away_team: { type: 'string' },
            status: { type: 'string', enum: ['scheduled', 'live', 'completed', 'cancelled'] },
          },
        },
        Team: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            sport: { type: 'string' },
            logo_url: { type: 'string', format: 'uri' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
