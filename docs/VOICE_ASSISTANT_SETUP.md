# Voice Assistant Setup Guide

## Overview
PantryIQ supports three ways to manage inventory with voice commands:
1. **Web-based Voice Assistant** - Built into the app, works in Chrome/Edge/Safari
2. **Google Assistant Integration** - "Hey Google, ask PantryIQ to add milk"
3. **Alexa Skills Integration** - "Alexa, tell PantryIQ I used the chicken"

## 1. Web-based Voice Assistant

### Requirements
- Chrome, Edge, or Safari browser
- Microphone permission granted to PantryIQ

### How to Use
1. Click the "Voice Assistant" button on the inventory page
2. Allow microphone access when prompted
3. Say commands like:
   - "Add Coca Cola 12 pack to pantry"
   - "Remove milk from inventory"
   - "Add organic bananas to kitchen counter"

### Features
- Natural language processing
- Automatic product recognition
- Smart location parsing
- Visual confirmation before actions

## 2. Google Assistant Integration

### Setup Steps

1. **Create Actions on Google Project**
   ```
   1. Go to https://console.actions.google.com/
   2. Create new project "PantryIQ"
   3. Choose "Custom" action type
   ```

2. **Configure Webhook**
   ```
   Webhook URL: https://bite.prolongedpantry.com/api/voice/google-assistant
   ```

3. **Define Intents**
   ```yaml
   Intents:
     - AddItem:
         Training phrases:
           - "add {product} to my {location}"
           - "put {product} in the {location}"
           - "store {product}"

     - RemoveItem:
         Training phrases:
           - "remove {product}"
           - "I used the {product}"
           - "take out {product}"

     - CheckExpiring:
         Training phrases:
           - "what's expiring"
           - "check expiration dates"
           - "what's going bad"
   ```

4. **Account Linking**
   ```
   Authorization URL: https://bite.prolongedpantry.com/auth/google
   Token URL: https://bite.prolongedpantry.com/api/auth/google/token
   Client ID: [Your Google Client ID]
   Client Secret: [Your Google Client Secret]
   ```

5. **Test & Deploy**
   - Test in Actions Console simulator
   - Submit for review
   - Once approved, users can say: "Hey Google, talk to PantryIQ"

### Voice Commands
- "Hey Google, ask PantryIQ to add milk to the fridge"
- "Hey Google, tell PantryIQ I'm out of eggs"
- "Hey Google, ask PantryIQ what's expiring soon"
- "Hey Google, ask PantryIQ how many apples I have"

## 3. Alexa Skills Integration

### Setup Steps

1. **Create Alexa Skill**
   ```
   1. Go to https://developer.amazon.com/alexa
   2. Create new skill "PantryIQ"
   3. Choose "Custom" model
   4. Select "Provision your own" hosting
   ```

2. **Configure Endpoint**
   ```
   Service Endpoint Type: HTTPS
   Default Region URL: https://bite.prolongedpantry.com/api/voice/alexa
   ```

3. **Interaction Model**
   ```json
   {
     "intents": [
       {
         "name": "AddItemIntent",
         "slots": [
           {
             "name": "product",
             "type": "AMAZON.Food"
           },
           {
             "name": "location",
             "type": "CUSTOM_LOCATION"
           }
         ],
         "samples": [
           "add {product} to my {location}",
           "put {product} in the {location}",
           "store {product} in my inventory"
         ]
       },
       {
         "name": "RemoveItemIntent",
         "slots": [
           {
             "name": "product",
             "type": "AMAZON.Food"
           }
         ],
         "samples": [
           "remove {product}",
           "I used the {product}",
           "mark {product} as consumed"
         ]
       },
       {
         "name": "CheckExpiringIntent",
         "samples": [
           "what's expiring",
           "check expiration dates",
           "what food is going bad"
         ]
       }
     ]
   }
   ```

4. **Account Linking**
   ```
   Authorization URI: https://bite.prolongedpantry.com/auth/alexa
   Access Token URI: https://bite.prolongedpantry.com/api/auth/alexa/token
   Client ID: [Your Alexa Client ID]
   Client Secret: [Your Alexa Client Secret]
   Authorization Grant Type: Auth Code Grant
   ```

5. **Testing & Certification**
   - Test in Alexa Developer Console
   - Test on Echo device
   - Submit for certification

### Voice Commands
- "Alexa, ask PantryIQ to add bread to my pantry"
- "Alexa, tell PantryIQ I'm out of milk"
- "Alexa, ask PantryIQ what's expiring this week"
- "Alexa, open PantryIQ and check my tomatoes"

## Security Considerations

### Authentication
- Both Google and Alexa require account linking
- Users must authorize PantryIQ in their respective apps
- OAuth 2.0 flow ensures secure token exchange

### Privacy
- Voice recordings are processed but not stored
- Product descriptions are parsed locally when possible
- Location data stays within user's household account

## Troubleshooting

### Web Voice Assistant Issues
**Problem**: Microphone not working
- Check browser permissions
- Ensure HTTPS connection
- Try different browser (Chrome recommended)

**Problem**: Speech not recognized
- Speak clearly and slowly
- Reduce background noise
- Check microphone input levels

### Google Assistant Issues
**Problem**: "Sorry, I can't find PantryIQ"
- Ensure skill is published
- Check region availability
- Link account in Google Home app

### Alexa Issues
**Problem**: "I don't know that skill"
- Enable skill in Alexa app
- Complete account linking
- Check skill name pronunciation

## Advanced Features

### Custom Wake Words (Future)
- Configure custom activation phrases
- Continuous listening mode
- Background operation support

### Multi-Language Support (Planned)
- Spanish: "Agregar leche a la nevera"
- French: "Ajouter du lait au frigo"
- German: "Füge Milch zum Kühlschrank hinzu"

### Smart Home Integration (Roadmap)
- Samsung SmartThings
- Apple HomeKit
- IFTTT webhooks

## API Rate Limits
- Google Assistant: 100 requests/minute per user
- Alexa Skills: 50 requests/minute per user
- Web Voice: Unlimited (processed locally)

## Support
For help with voice assistant setup:
- Email: support@pantryiq.app
- Documentation: https://docs.pantryiq.app/voice
- Community Forum: https://community.pantryiq.app