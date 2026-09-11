FROM nginx:stable-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css app.js /usr/share/nginx/html/
COPY docs /usr/share/nginx/html/docs
COPY data /usr/share/nginx/html/data

EXPOSE 80
