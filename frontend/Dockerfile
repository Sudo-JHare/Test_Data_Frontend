# Use Nginx base image
FROM nginx:alpine

# Copy index.html to Nginx html directory
COPY index.html /usr/share/nginx/html/

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
