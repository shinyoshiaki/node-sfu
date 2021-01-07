import { Button, PositionProps } from "@chakra-ui/react";
import { ChangeEvent, FC, useRef } from "react";

export const FilePicker: FC<
  { onSelect: (file: File) => void } & PositionProps
> = (props) => {
  const hiddenFileInput = useRef(null);

  const handleClick = () => {
    hiddenFileInput.current.click();
  };
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileUploaded = event.target.files[0];
    props.onSelect(fileUploaded);
  };

  return (
    <>
      <Button onClick={handleClick} {...(props as any)}>
        {props.children}
      </Button>
      <input
        type="file"
        ref={hiddenFileInput}
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </>
  );
};
