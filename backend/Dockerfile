FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY nuget.config Directory.Build.props Noxen.Crm.slnx ./
COPY src/Noxen.Crm.Domain/*.csproj src/Noxen.Crm.Domain/
COPY src/Noxen.Crm.Infrastructure/*.csproj src/Noxen.Crm.Infrastructure/
COPY src/Noxen.Crm.Api/*.csproj src/Noxen.Crm.Api/
COPY src/Noxen.Crm.Worker/*.csproj src/Noxen.Crm.Worker/
RUN dotnet restore src/Noxen.Crm.Api && dotnet restore src/Noxen.Crm.Worker
COPY src/ src/
RUN dotnet publish src/Noxen.Crm.Api -c Release --no-restore -o /out/api \
 && dotnet publish src/Noxen.Crm.Worker -c Release --no-restore -o /out/worker

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS api
WORKDIR /app
COPY --from=build /out/api .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Noxen.Crm.Api.dll"]

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS worker
WORKDIR /app
COPY --from=build /out/worker .
USER $APP_UID
ENTRYPOINT ["dotnet", "Noxen.Crm.Worker.dll"]
