# Use Nginx base image
FROM nginx:alpine

# Install envsubst (part of gettext)
RUN apk add --no-cache gettext

# Remove default Nginx configuration
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom Nginx configuration template
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Copy index.html to Nginx html directory
COPY index.html /usr/share/nginx/html/

# Substitute environment variables and start Nginx
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

# Expose port 80
EXPOSE 80
