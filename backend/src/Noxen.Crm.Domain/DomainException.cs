namespace Noxen.Crm.Domain;

/// <summary>Violação de regra de negócio; a API a traduz para 422.</summary>
public sealed class DomainException(string message) : Exception(message);
