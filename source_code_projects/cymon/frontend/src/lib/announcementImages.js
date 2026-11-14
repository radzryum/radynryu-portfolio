// Normalize one announcement record to its slideshow image list,
// falling back to the legacy single `image_url` cover photo.
export const announcementImages = (a) =>
  Array.isArray(a?.image_urls) && a.image_urls.length
    ? a.image_urls.filter(Boolean)
    : (a?.image_url ? [a.image_url] : [])
