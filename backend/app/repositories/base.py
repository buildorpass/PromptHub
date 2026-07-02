from abc import ABC, abstractmethod
from typing import Generic, TypeVar, List, Optional

T = TypeVar("T")


class AbstractRepository(ABC, Generic[T]):
    @abstractmethod
    async def get(self, id: int) -> Optional[T]: ...

    @abstractmethod
    async def list(self, skip: int, limit: int, **filters) -> List[T]: ...

    @abstractmethod
    async def create(self, obj: dict) -> T: ...

    @abstractmethod
    async def update(self, id: int, obj: dict) -> T: ...

    @abstractmethod
    async def delete(self, id: int) -> bool: ...


class AbstractPromptRepository(AbstractRepository):
    @abstractmethod
    async def search(
        self,
        query: str,
        folder_id: Optional[int],
        tags: Optional[List[str]],
    ) -> List: ...

    @abstractmethod
    async def count(self, **filters) -> int: ...


class AbstractFolderRepository(AbstractRepository):
    @abstractmethod
    async def list_children(self, parent_id: Optional[int]) -> List: ...


class AbstractVersionRepository(AbstractRepository):
    @abstractmethod
    async def get_latest(self, prompt_id: int): ...

    @abstractmethod
    async def list_for_prompt(self, prompt_id: int) -> List: ...

    @abstractmethod
    async def get_next_version_number(self, prompt_id: int) -> int: ...


class AbstractPricingRepository(AbstractRepository):
    @abstractmethod
    async def get_by_model(self, model_name: str): ...


class AbstractRunRepository(AbstractRepository):
    @abstractmethod
    async def list_for_version(self, prompt_version_id: int) -> List: ...


class AbstractRunResultRepository(AbstractRepository):
    @abstractmethod
    async def list_for_run(self, test_run_id: int) -> List: ...

    @abstractmethod
    async def update_rating(self, id: int, rating: int, tag: Optional[str]): ...


class AbstractAssetRepository(AbstractRepository):
    @abstractmethod
    async def get_by_name(self, name: str): ...

    @abstractmethod
    async def search(self, query: str, asset_type: Optional[str]) -> List: ...


class AbstractTestCaseRepository(AbstractRepository):
    @abstractmethod
    async def list_for_version(self, prompt_version_id: int) -> List: ...
