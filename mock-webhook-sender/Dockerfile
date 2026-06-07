FROM alpine:3.19

RUN apk add --no-cache curl jq

COPY send.sh /send.sh
RUN chmod +x /send.sh

CMD ["/send.sh"]
