FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY CodeFest.Api/*.csproj ./CodeFest.Api/
RUN dotnet restore CodeFest.Api/CodeFest.Api.csproj
COPY CodeFest.Api/ ./CodeFest.Api/
RUN dotnet publish CodeFest.Api/CodeFest.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
COPY seed-data/ ./seed-data/
EXPOSE 8080
ENTRYPOINT ["dotnet", "CodeFest.Api.dll"]
