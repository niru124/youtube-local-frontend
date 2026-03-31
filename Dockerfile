FROM archlinux:latest

WORKDIR /app

RUN pacman -Sy --noconfirm python python-pip

COPY . /app/

RUN pacman -S --noconfirm \
    python-flask \
    python-gevent \
    python-requests \
    python-pyyaml \
    python-urllib3 \
    python-socks \
    python-stem \
    python-cachetools \
    python-defusedxml

ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "server.py"]
