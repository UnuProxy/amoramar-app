# 📸 Images Folder

This folder contains all static images for your website.

## 📁 Folder Structure

### `/hero/`
**For:** Main landing page hero/banner images
- Example: `hero-main.jpg`, `hero-spa.jpg`
- Recommended size: 1920x1080px or larger
- Format: JPG or WebP

### `/services/`
**For:** Service/treatment photos
- Example: `nails-treatment.jpg`, `haircut.jpg`
- Recommended size: 800x600px
- Format: JPG or WebP

### `/team/`
**For:** Team member photos (therapists/staff)
- Example: `stella-marriot.jpg`, `marie-sally.jpg`
- Recommended size: 400x400px (square)
- Format: JPG or WebP

### `/gallery/`
**For:** Salon photos, before/after, portfolio
- Example: `salon-interior-1.jpg`, `before-after-nails.jpg`
- Recommended size: 800x600px
- Format: JPG or WebP

## 🖼️ How to Use Images in Your Website

Once you add an image to any folder, you can use it like this:

```jsx
// In your React/Next.js code:
<img src="/images/hero/hero-main.jpg" alt="Description" />

// Or with Next.js Image component (optimized):
import Image from 'next/image';
<Image src="/images/team/stella-marriot.jpg" alt="Stella Marriot" width={400} height={400} />
```

## ✅ Best Practices

1. **Use descriptive names:** `haircut-service.jpg` instead of `img1.jpg`
2. **Optimize before upload:** Compress images to reduce file size
3. **Use lowercase:** `my-image.jpg` instead of `My-Image.JPG`
4. **No spaces:** Use hyphens: `before-after.jpg` instead of `before after.jpg`

## 📏 Recommended Sizes

| Type | Size | Aspect Ratio |
|------|------|--------------|
| Hero/Banner | 1920x1080px | 16:9 |
| Service Photos | 800x600px | 4:3 |
| Team Photos | 400x400px | 1:1 (square) |
| Gallery | 800x600px | 4:3 |

---

**Need help adding images to the website? Just ask!** 🚀




