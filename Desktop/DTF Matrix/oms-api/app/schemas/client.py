import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field


class ClientContactCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    telephone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None


class ClientContactUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    telephone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None


class ClientContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    client_id: uuid.UUID
    nom: str
    telephone: str | None
    email: EmailStr | None
    created_at: datetime


class ClientCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    nom_facture: str | None = Field(default=None, max_length=255)
    contact: str | None = Field(default=None, max_length=255)
    ville: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    telephone: str | None = Field(default=None, max_length=50)
    adresse: str | None = Field(default=None, max_length=500)


class ClientUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    nom_facture: str | None = Field(default=None, max_length=255)
    contact: str | None = Field(default=None, max_length=255)
    ville: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    telephone: str | None = Field(default=None, max_length=50)
    adresse: str | None = Field(default=None, max_length=500)


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    nom_facture: str | None
    contact: str | None
    ville: str | None
    email: EmailStr | None
    telephone: str | None
    adresse: str | None
    contacts: list[ClientContactRead] = []
    created_at: datetime
    updated_at: datetime
