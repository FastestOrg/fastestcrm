import React from "react";

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
}

/**
 * Drop-in replacement for next/image in Vite React environments.
 * Handles responsive images, dimensions, fill mode, and lazy loading.
 */
export const Image: React.FC<ImageProps> = ({
  src,
  alt,
  width,
  height,
  className = "",
  style,
  fill,
  priority,
  unoptimized: _unoptimized,
  ...props
}) => {
  return (
    <img
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      style={{
        ...(fill ? { width: "100%", height: "100%", objectFit: "cover" } : {}),
        ...style,
      }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...props}
    />
  );
};

export default Image;
