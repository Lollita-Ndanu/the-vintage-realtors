# Content Manager Guide - The Vintage Realtors

## How to Upload Properties

### Initial Setup (One-Time)

1. **Enable Netlify Identity:**
   - Go to your Netlify dashboard
   - Navigate to Site Settings > Identity
   - Click "Enable Identity"

2. **Enable Git Gateway:**
   - In Identity settings, scroll to "Services"
   - Click "Enable Git Gateway"

3. **Invite Users:**
   - Go to Identity tab
   - Click "Invite users"
   - Add email addresses for people who can manage properties

### Accessing the Content Manager

1. Visit: `https://your-site-url.netlify.app/admin`
2. Click "Login with Netlify Identity"
3. Enter your credentials (check email for invitation)

### Adding a New Property

1. **Log into the admin panel** at `/admin`
2. Click on **"Properties"** collection
3. Click **"New Properties"** button
4. Fill in the property details:
   - **Title:** Property name (e.g., "3 Bedroom Apartment in Westlands")
   - **Price:** Full price string (e.g., "KES 38,500,000" or "KES 180,000 / month")
   - **Bedrooms:** Number of bedrooms
   - **Bathrooms:** Number of bathrooms
   - **Status:** Select "For Sale", "For Rent", or "Sold"
   - **Location:** Area and city (e.g., "Kilimani, Nairobi")
   - **Main Image:** Upload or select an image
   - **Description:** Short description for cards
   - **Body:** Full property description (supports markdown)

5. Click **"Publish"** (top right)
   - The property will be saved as a `.md` file in `admin/properties/`
   - It will automatically appear on your website

### Editing Properties

1. Go to `/admin`
2. Click "Properties" collection
3. Select the property you want to edit
4. Make your changes
5. Click "Publish" to save

### Deleting Properties

1. Go to `/admin`
2. Click "Properties"
3. Select the property
4. Click "Delete entry" (in the publish dropdown)

## Automatic Updates

When you publish a property via the CMS:
- ✅ A new `.md` file is created in `admin/properties/`
- ✅ The file is committed to your Git repository
- ✅ Netlify automatically rebuilds your site
- ✅ The property appears on your website within 1-2 minutes

## Updating the Property Index

After adding properties via the CMS, you need to regenerate the index file so your website can find them.

**Option 1: Manual (Local Development)**
```bash
node scripts/generate-properties-index.js
git add admin/properties/index.json
git commit -m "Update properties index"
git push
```

**Option 2: Automatic (Recommended)**
Add this to your Netlify build settings:

**Build command:**
```bash
node scripts/generate-properties-index.js
```

This ensures `admin/properties/index.json` is updated every time you deploy.

## Troubleshooting

**Problem:** New properties don't show on the website
- **Solution:** Make sure `admin/properties/index.json` is updated by running the generator script

**Problem:** Can't access `/admin`
- **Solution:** Verify Netlify Identity is enabled and you've been invited

**Problem:** Images not showing
- **Solution:** Check that images are uploaded via the CMS (they go to `images/uploads/`)

## File Structure

```
admin/
  properties/          ← New properties saved here as .md files
    index.json         ← List of all property files
  config.yml           ← CMS configuration
  index.html           ← CMS interface

scripts/
  generate-properties-index.js  ← Regenerates index.json
```

## Support

For issues with the CMS, check:
- Netlify Identity is enabled
- Git Gateway is enabled
- You have push access to the repository
- The build completes successfully on Netlify
