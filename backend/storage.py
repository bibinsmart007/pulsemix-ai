import abc
import os
import shutil
import time
from typing import Optional, Dict, Any

class StorageBackend(abc.ABC):
    """Abstract base class for storage adapters."""
    
    @abc.abstractmethod
    def upload_file(self, source_path: str, object_key: str, content_type: str = "application/octet-stream") -> str:
        pass
        
    @abc.abstractmethod
    def download_file(self, object_key: str, destination_path: str) -> bool:
        pass
        
    @abc.abstractmethod
    def generate_access_url(self, object_key: str, expiration_seconds: int = 3600) -> str:
        pass
        
    @abc.abstractmethod
    def delete_file(self, object_key: str) -> bool:
        pass
        
    @abc.abstractmethod
    def exists(self, object_key: str) -> bool:
        pass
        
    @abc.abstractmethod
    def get_metadata(self, object_key: str) -> Optional[Dict[str, Any]]:
        pass
        
    @abc.abstractmethod
    def copy_object(self, source_key: str, destination_key: str) -> bool:
        pass


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_dir: str, base_url: str):
        self.base_dir = os.path.abspath(base_dir)
        self.base_url = base_url
        os.makedirs(self.base_dir, exist_ok=True)
        
    def _get_path(self, object_key: str) -> str:
        return os.path.abspath(os.path.join(self.base_dir, object_key))
        
    def upload_file(self, source_path: str, object_key: str, content_type: str = "application/octet-stream") -> str:
        dest_path = self._get_path(object_key)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        shutil.copy2(source_path, dest_path)
        return object_key
        
    def download_file(self, object_key: str, destination_path: str) -> bool:
        src = self._get_path(object_key)
        if not os.path.exists(src): return False
        os.makedirs(os.path.dirname(destination_path), exist_ok=True)
        shutil.copy2(src, destination_path)
        return True
        
    def generate_access_url(self, object_key: str, expiration_seconds: int = 3600) -> str:
        # Local storage doesn't really have signed URLs, just return the static route
        return f"{self.base_url}/{object_key}"
        
    def delete_file(self, object_key: str) -> bool:
        path = self._get_path(object_key)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False
        
    def exists(self, object_key: str) -> bool:
        return os.path.exists(self._get_path(object_key))
        
    def get_metadata(self, object_key: str) -> Optional[Dict[str, Any]]:
        path = self._get_path(object_key)
        if not os.path.exists(path): return None
        stat = os.stat(path)
        return {
            "size": stat.st_size,
            "created_at": stat.st_ctime,
            "updated_at": stat.st_mtime
        }
        
    def copy_object(self, source_key: str, destination_key: str) -> bool:
        src = self._get_path(source_key)
        dst = self._get_path(destination_key)
        if not os.path.exists(src): return False
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        return True


class S3StorageBackend(StorageBackend):
    def __init__(self, bucket_name: str, endpoint_url: str = None, access_key: str = None, secret_key: str = None, region_name: str = None):
        import boto3
        from botocore.config import Config
        self.bucket_name = bucket_name
        self.s3_client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region_name,
            config=Config(signature_version='s3v4')
        )

    def upload_file(self, source_path: str, object_key: str, content_type: str = "application/octet-stream") -> str:
        self.s3_client.upload_file(
            source_path, self.bucket_name, object_key,
            ExtraArgs={'ContentType': content_type}
        )
        return object_key

    def download_file(self, object_key: str, destination_path: str) -> bool:
        try:
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
            self.s3_client.download_file(self.bucket_name, object_key, destination_path)
            return True
        except Exception:
            return False

    def generate_access_url(self, object_key: str, expiration_seconds: int = 3600) -> str:
        return self.s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket_name, 'Key': object_key},
            ExpiresIn=expiration_seconds
        )

    def delete_file(self, object_key: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_key)
            return True
        except Exception:
            return False

    def exists(self, object_key: str) -> bool:
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=object_key)
            return True
        except Exception:
            return False

    def get_metadata(self, object_key: str) -> Optional[Dict[str, Any]]:
        try:
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=object_key)
            return {
                "size": response.get('ContentLength'),
                "content_type": response.get('ContentType'),
                "updated_at": response.get('LastModified').timestamp() if response.get('LastModified') else None,
                "etag": response.get('ETag')
            }
        except Exception:
            return None

    def copy_object(self, source_key: str, destination_key: str) -> bool:
        try:
            copy_source = {'Bucket': self.bucket_name, 'Key': source_key}
            self.s3_client.copy_object(CopySource=copy_source, Bucket=self.bucket_name, Key=destination_key)
            return True
        except Exception:
            return False


class GCSStorageBackend(StorageBackend):
    def __init__(self, bucket_name: str, credentials_path: str = None):
        from google.cloud import storage
        if credentials_path:
            self.client = storage.Client.from_service_account_json(credentials_path)
        else:
            self.client = storage.Client()
        self.bucket = self.client.bucket(bucket_name)

    def upload_file(self, source_path: str, object_key: str, content_type: str = "application/octet-stream") -> str:
        blob = self.bucket.blob(object_key)
        blob.upload_from_filename(source_path, content_type=content_type)
        return object_key

    def download_file(self, object_key: str, destination_path: str) -> bool:
        try:
            blob = self.bucket.blob(object_key)
            if not blob.exists(): return False
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
            blob.download_to_filename(destination_path)
            return True
        except Exception:
            return False

    def generate_access_url(self, object_key: str, expiration_seconds: int = 3600) -> str:
        blob = self.bucket.blob(object_key)
        return blob.generate_signed_url(expiration=expiration_seconds, version="v4")

    def delete_file(self, object_key: str) -> bool:
        try:
            blob = self.bucket.blob(object_key)
            blob.delete()
            return True
        except Exception:
            return False

    def exists(self, object_key: str) -> bool:
        blob = self.bucket.blob(object_key)
        return blob.exists()

    def get_metadata(self, object_key: str) -> Optional[Dict[str, Any]]:
        blob = self.bucket.get_blob(object_key)
        if not blob: return None
        return {
            "size": blob.size,
            "content_type": blob.content_type,
            "updated_at": blob.updated.timestamp() if blob.updated else None,
            "etag": blob.etag
        }

    def copy_object(self, source_key: str, destination_key: str) -> bool:
        try:
            source_blob = self.bucket.blob(source_key)
            if not source_blob.exists(): return False
            self.bucket.copy_blob(source_blob, self.bucket, destination_key)
            return True
        except Exception:
            return False

# Global Storage Manager (defaults to Local for now)
import os

STORAGE_PROVIDER = os.environ.get("STORAGE_PROVIDER", "local").lower()

if STORAGE_PROVIDER == "s3":
    storage_backend = S3StorageBackend(
        bucket_name=os.environ.get("S3_BUCKET_NAME", "pulsemix-bucket"),
        endpoint_url=os.environ.get("S3_ENDPOINT_URL"),
        access_key=os.environ.get("AWS_ACCESS_KEY_ID"),
        secret_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        region_name=os.environ.get("AWS_REGION", "us-east-1")
    )
elif STORAGE_PROVIDER == "gcs":
    storage_backend = GCSStorageBackend(
        bucket_name=os.environ.get("GCS_BUCKET_NAME", "pulsemix-bucket"),
        credentials_path=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    )
else:
    # Default to LocalStorage
    storage_backend = LocalStorageBackend(
        base_dir=os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "storage"),
        base_url="http://localhost:3000/storage"
    )

def get_storage() -> StorageBackend:
    return storage_backend
