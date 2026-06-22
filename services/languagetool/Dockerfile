FROM eclipse-temurin:21-jre

ARG LT_VERSION=6.6
WORKDIR /opt/languagetool

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl unzip \
  && curl -fsSL "https://www.languagetool.org/download/LanguageTool-${LT_VERSION}.zip" -o /tmp/languagetool.zip \
  && unzip /tmp/languagetool.zip -d /opt \
  && mv "/opt/LanguageTool-${LT_VERSION}"/* /opt/languagetool/ \
  && rm -rf /var/lib/apt/lists/* /tmp/languagetool.zip

RUN printf "" > /opt/languagetool/server.properties

EXPOSE 8081

CMD ["java", "-cp", "languagetool-server.jar", "org.languagetool.server.HTTPServer", "--config", "server.properties", "--port", "8081", "--public"]
