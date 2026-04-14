import React from 'react';

interface VideoSchemaProps {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration: string; // ISO 8601 format e.g. "PT1M33S"
  embedUrl: string;
}

const VideoSchema: React.FC<VideoSchemaProps> = ({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  duration,
  embedUrl
}) => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name,
    "description": description,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": uploadDate,
    "duration": duration,
    "embedUrl": embedUrl,
    "publisher": {
      "@type": "Organization",
      "name": "Fastest CRM",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.fastestcrm.com/fastestcrmlogo.png"
      }
    }
  };

  return (
    <script type="application/ld+json">
      {JSON.stringify(jsonLd)}
    </script>
  );
};

export default VideoSchema;
