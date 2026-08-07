ARG BASE_IMAGE=local/erpnext-crm:v16.30.0-crm1.81.0
FROM ${BASE_IMAGE}

USER root
COPY --chown=frappe:frappe frappe_apps/hwerp /home/frappe/frappe-bench/apps/hwerp

USER frappe
RUN uv pip install \
    --python /home/frappe/frappe-bench/env/bin/python \
    --no-deps \
    /home/frappe/frappe-bench/apps/hwerp \
    && /home/frappe/frappe-bench/env/bin/python -B -m hwerp.image_setup \
        /home/frappe/frappe-bench/sites/apps.txt

WORKDIR /home/frappe/frappe-bench
